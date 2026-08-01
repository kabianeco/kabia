/**
 * One-time bootstrap of the first Kabia administrator.
 *
 *   npm run admin:bootstrap
 *
 * What it does, in order:
 *   1. refuses to run without server-side Supabase credentials;
 *   2. refuses weak credentials outright when NODE_ENV is production;
 *   3. tries the requested development password, and falls back to a generated
 *      one if Supabase's password policy rejects it — the policy is never
 *      weakened to accommodate the request;
 *   4. creates the auth user through the Auth Admin API — never by inserting
 *      into auth.users;
 *   5. assigns super_admin in public.user_roles;
 *   6. records the bootstrap in the audit log;
 *   7. writes a generated password to .admin-bootstrap-credentials with 0600
 *      permissions, and never prints it.
 *
 * It is idempotent: run it twice and the second run reports the existing
 * account and changes nothing. It never silently resets the password of an
 * account that already exists.
 *
 * Run with Node's native TypeScript support (Node 22.6+):
 *   node --env-file=.env.local scripts/bootstrap-admin.ts
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { chmod, writeFile } from "node:fs/promises"
import { randomBytes } from "node:crypto"
import path from "node:path"

const REQUESTED_PASSWORD = "admin"
const CREDENTIALS_FILE = ".admin-bootstrap-credentials"

interface Outcome {
  userId: string
  email: string
  created: boolean
  passwordUsed: "requested" | "generated" | "unchanged"
  generatedPassword?: string
}

function fail(message: string): never {
  console.error(`\n  ✗ ${message}\n`)
  process.exit(1)
}

function info(message: string) {
  console.log(`  · ${message}`)
}

function ok(message: string) {
  console.log(`  ✓ ${message}`)
}

/** ~150 bits of entropy, and satisfies any realistic complexity policy. */
function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
  const symbols = "!@#$%^&*-_=+"
  const bytes = randomBytes(26)
  let out = ""
  for (let i = 0; i < 24; i++) out += alphabet[bytes[i] % alphabet.length]
  out += symbols[bytes[24] % symbols.length]
  out += String(bytes[25] % 10)
  return out
}

function isWeak(password: string): boolean {
  return password.length < 12
}

async function findUserByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<{ id: string; email: string } | null> {
  // The Admin API has no direct get-by-email, so page through until found.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) fail(`Kullanıcı listesi okunamadı: ${error.message}`)
    if (!data || data.users.length === 0) return null
    const match = data.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    )
    if (match) return { id: match.id, email: match.email ?? email }
    if (data.users.length < 200) return null
  }
  return null
}

async function main() {
  console.log("\n  Kabia — yönetici kurulumu\n")

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const nodeEnv = process.env.NODE_ENV ?? "development"
  const isProduction = nodeEnv === "production"

  if (!url) fail("NEXT_PUBLIC_SUPABASE_URL tanımlı değil.")
  if (!serviceKey) {
    fail(
      "SUPABASE_SERVICE_ROLE_KEY tanımlı değil.\n" +
        "    Bu betik Supabase Auth Admin API'sini kullanır ve yalnızca güvenilir bir\n" +
        "    sunucu ortamında çalıştırılmalıdır. Anahtarı .env.local dosyasına ekleyin\n" +
        "    (NEXT_PUBLIC_ öneki OLMADAN).",
    )
  }

  const username = (process.env.ADMIN_BOOTSTRAP_USERNAME || "admin").trim()
  const email = (process.env.ADMIN_BOOTSTRAP_EMAIL || "admin@kabia.local").trim().toLowerCase()

  info(`Ortam: ${nodeEnv}`)
  info(`Kullanıcı adı takma adı: ${username}`)
  info(`Auth kimliği: ${email}`)

  // ---- production safeguard ----------------------------------------------
  // The weak admin:admin pair must never be enabled in production, even by
  // accident, and even if Supabase's own policy would accept it.
  let candidatePassword = REQUESTED_PASSWORD
  let passwordUsed: Outcome["passwordUsed"] = "requested"

  if (isProduction) {
    const override = process.env.ADMIN_BOOTSTRAP_PASSWORD
    if (!override) {
      candidatePassword = generatePassword()
      passwordUsed = "generated"
      info("Üretim ortamı: zayıf kurulum parolası reddedildi, güvenli parola üretiliyor.")
    } else if (isWeak(override)) {
      fail(
        "Üretim ortamında ADMIN_BOOTSTRAP_PASSWORD en az 12 karakter olmalı.\n" +
          "    Zayıf kurulum parolaları üretimde kabul edilmez.",
      )
    } else {
      candidatePassword = override
      passwordUsed = "requested"
      info("Üretim ortamı: sağlanan güçlü parola kullanılacak.")
    }
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ---- idempotency --------------------------------------------------------
  const existing = await findUserByEmail(admin, email)

  let outcome: Outcome

  if (existing) {
    ok(`Hesap zaten mevcut (${email}).`)
    info("Mevcut hesabın parolası DEĞİŞTİRİLMEDİ.")
    outcome = {
      userId: existing.id,
      email: existing.email,
      created: false,
      passwordUsed: "unchanged",
    }
  } else {
    let { data, error } = await admin.auth.admin.createUser({
      email,
      password: candidatePassword,
      email_confirm: true,
      user_metadata: { full_name: "Kabia Yöneticisi" },
    })

    // The requested development password may be shorter than the project's
    // minimum. Fall back rather than lowering the policy.
    if (error && passwordUsed === "requested" && !isProduction) {
      info(`Supabase parola politikası "${REQUESTED_PASSWORD}" parolasını reddetti.`)
      info("Politika değiştirilmiyor; güvenli bir geçici parola üretiliyor.")
      candidatePassword = generatePassword()
      passwordUsed = "generated"
      ;({ data, error } = await admin.auth.admin.createUser({
        email,
        password: candidatePassword,
        email_confirm: true,
        user_metadata: { full_name: "Kabia Yöneticisi" },
      }))
    }

    if (error || !data?.user) {
      fail(`Yönetici hesabı oluşturulamadı: ${error?.message ?? "bilinmeyen hata"}`)
    }

    ok(`Auth hesabı oluşturuldu (${email}).`)
    if (passwordUsed === "requested") {
      ok(`İstenen geliştirme parolası ("${REQUESTED_PASSWORD}") kabul edildi.`)
    }

    outcome = {
      userId: data.user.id,
      email,
      created: true,
      passwordUsed,
      generatedPassword: passwordUsed === "generated" ? candidatePassword : undefined,
    }
  }

  // ---- profile ------------------------------------------------------------
  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ id: outcome.userId, full_name: "Kabia Yöneticisi" }, { onConflict: "id" })
  if (profileError) {
    info(`Profil güncellenemedi (kritik değil): ${profileError.message}`)
  }

  // ---- role ---------------------------------------------------------------
  const { data: existingRole } = await admin
    .from("user_roles")
    .select("user_id, role, is_active")
    .eq("user_id", outcome.userId)
    .maybeSingle()

  if (existingRole) {
    if (existingRole.role === "super_admin" && existingRole.is_active) {
      ok("Rol zaten super_admin ve aktif — değişiklik yapılmadı.")
    } else {
      // The identity was verified above: this is the configured bootstrap email.
      const { error } = await admin
        .from("user_roles")
        .update({ role: "super_admin", is_active: true })
        .eq("user_id", outcome.userId)
      if (error) fail(`Rol güncellenemedi: ${error.message}`)
      ok("Rol super_admin olarak güncellendi.")
    }
  } else {
    const { error } = await admin.from("user_roles").insert({
      user_id: outcome.userId,
      role: "super_admin",
      is_active: true,
      // A generated password must be rotated by its owner on first sign-in.
      must_change_password: outcome.passwordUsed === "generated",
    })
    if (error) fail(`Rol atanamadı: ${error.message}`)
    ok("super_admin rolü atandı.")
  }

  // ---- audit --------------------------------------------------------------
  // log_admin_action() derives its actor from auth.uid(), which a service-role
  // script does not have, so the bootstrap row is written directly. It is the
  // one audit entry not produced by an interactive session, and it says so.
  const { error: auditError } = await admin.from("admin_audit_logs").insert({
    admin_user_id: outcome.userId,
    admin_role: "super_admin",
    action: "admin.bootstrap",
    entity_type: "administrator",
    entity_id: outcome.userId,
    after_data: { role: "super_admin", is_active: true },
    metadata: {
      email: outcome.email,
      created: outcome.created,
      password_source: outcome.passwordUsed,
      environment: nodeEnv,
      via: "scripts/bootstrap-admin.ts",
    },
  })
  if (auditError) {
    info(`Denetim kaydı yazılamadı (kritik değil): ${auditError.message}`)
  } else {
    ok("Kurulum denetim kaydına yazıldı.")
  }

  // ---- credentials file ---------------------------------------------------
  if (outcome.generatedPassword) {
    const filePath = path.resolve(process.cwd(), CREDENTIALS_FILE)
    const body =
      `# Kabia yönetici kurulum bilgileri\n` +
      `# Oluşturulma: ${new Date().toISOString()}\n` +
      `# Bu dosya .gitignore içindedir ve ASLA depoya eklenmemelidir.\n` +
      `# Giriş yaptıktan sonra parolayı değiştirin ve bu dosyayı silin.\n\n` +
      `URL=/admin/login\n` +
      `USERNAME=${username}\n` +
      `EMAIL=${outcome.email}\n` +
      `PASSWORD=${outcome.generatedPassword}\n`

    await writeFile(filePath, body, { encoding: "utf8", mode: 0o600 })
    try {
      await chmod(filePath, 0o600)
    } catch {
      info("Dosya izinleri 0600 olarak ayarlanamadı (bu platformda desteklenmiyor olabilir).")
    }

    ok(`Geçici parola şu dosyaya yazıldı: ${CREDENTIALS_FILE}`)
    info("Parola bilinçli olarak ekrana yazdırılmadı.")
    info("İlk girişten sonra parolayı değiştirmeniz istenecek.")
  } else if (outcome.created && outcome.passwordUsed === "requested") {
    info(`Giriş: kullanıcı adı "${username}", parola "${REQUESTED_PASSWORD}".`)
    info("Bu yalnızca geliştirme içindir — üretimde kabul edilmez.")
  }

  console.log("")
  ok("Kurulum tamamlandı.")
  console.log(`\n  Giriş adresi: /admin/login`)
  console.log(`  Kullanıcı adı: ${username}\n`)
}

main().catch((error) => {
  console.error("\n  ✗ Beklenmeyen hata:", error instanceof Error ? error.message : error)
  process.exit(1)
})
