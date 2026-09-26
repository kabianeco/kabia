# Kabia e-posta şablonları — Supabase Auth (A Grubu)

Bu klasördeki üç HTML dosyası, Supabase panosuna olduğu gibi yapıştırılır.
Gönderimi Supabase Auth yapar. Bağlantılar uygulamanın `/auth/confirm`
rotasına gelir; rota `token_hash` değerini doğrulayıp oturumu kurar.

## Dosyalar ve konu satırları

| Dosya | Panodaki şablon | Konu satırı (aynen yazın) |
|---|---|---|
| `confirm-signup.html` | Confirm signup | `E-posta adresinizi doğrulayın` |
| `reset-password.html` | Reset password | `Şifrenizi sıfırlayın` |
| `change-email.html` | Change email address | `Yeni e-posta adresinizi doğrulayın` |

Magic link, Email OTP ve Reauthentication şablonları bilerek yoktur:
uygulama bu akışları kullanmıyor. Confirm signup şablonu, bağlantıya ek
olarak `{{ .Token }}` ile altı haneli kayıt doğrulama kodunu gösterir.
Davet (Invite user) şablonu da yoktur: yöneticiler
`admin.auth.admin.createUser` ile `email_confirm: true` oluşturulur, davet
e-postası gönderilmez.

## Yapıştırma adımları

1. Supabase panosunda projeyi açın: **Authentication → Email Templates**.
2. Listeden şablonu seçin (önce **Confirm signup**).
3. **Subject** alanına yukarıdaki tablodaki konu satırını yazın.
4. Dosyanın **tüm içeriğini** kopyalayıp **Message body** alanına yapıştırın.
5. **Save** ile kaydedin.
6. Üç şablon için tekrarlayın.
7. **Üç HTML dosyasının tamamını yeniden yapıştırın**; eski şablonlarda
   `{{ .ConfirmationURL }}` kaldığında yeni sayfalara yönlendirme olmaz.
8. Yeni bir test hesabıyla kayıt bağlantısını ve kodunu; ayrıca şifre
   sıfırlama ve e-posta değişikliği bağlantılarını ayrı ayrı deneyin.

## Alan adı değişiminde yapılacaklar

Hiçbir şablonu ellemenize gerek yok. Panoda
**Authentication → URL Configuration → Site URL** alanını
`https://kabiaekolojik.com` yapmanız yeterli: logo dahil tüm mutlak
adresler `{{ .SiteURL }}` değişkeninden gelir. Şu an Site URL
`https://kabia-revised.vercel.app` olmalıdır. Üretim ortamında
`NEXT_PUBLIC_SITE_URL` aynı kökeni göstermelidir; alan adı değiştiğinde
bu değeri de güncelleyip yeniden dağıtın.
**Authentication → URL Configuration → Redirect URLs** altında
`https://kabia-revised.vercel.app/auth/confirm?type=recovery&next=/sifre-yenile`
izinli olmalıdır (aynı yolu kapsayan mevcut bir izin de yeterlidir).
`resetPasswordForEmail` bu adresi `redirectTo` olarak gönderir.
Alan adı değişirse bu izinli adresi de yeni alan adına taşıyın.

## Bağlantı biçimi

Şablonlar `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}`
adresine gider. Tür ve izinli sonraki sayfa her şablonda sabittir:

| Şablon | `type` | `next` |
|---|---|---|
| Confirm signup | `email` | `/eposta-onaylandi` |
| Reset password | `recovery` | `/sifre-yenile` |
| Change email address | `email_change` | `/eposta-degisikligi-onaylandi` |

`next` yalnızca bu üç eşleşmeden biri olduğunda kabul edilir. Bağlantılar
başka tarayıcı veya cihazda da açılabilir; PKCE kod değişimi kullanılmaz.

Supabase panosunda **Confirm Email** açık, **Email OTP Length** 6 olmalıdır.
**Email OTP Expiration** kayıt, kurtarma ve e-posta değişikliği bağlantılarını
da kapsar; kullanımınıza uygun bir süre seçin (örneğin 1 saat).

## Değişkenler

Şablonlar `{{ .SiteURL }}` ve `{{ .TokenHash }}` kullanır; kayıt şablonu
ayrıca `{{ .Token }}` gösterir.
