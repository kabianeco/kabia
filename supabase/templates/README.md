# Kabia e-posta şablonları — Supabase Auth (A Grubu)

Bu klasördeki üç HTML dosyası, Supabase panosuna olduğu gibi yapıştırılır.
Kodda karşılıkları yoktur; gönderimi Supabase Auth yapar.

## Dosyalar ve konu satırları

| Dosya | Panodaki şablon | Konu satırı (aynen yazın) |
|---|---|---|
| `confirm-signup.html` | Confirm signup | `E-posta adresinizi doğrulayın` |
| `reset-password.html` | Reset password | `Şifrenizi sıfırlayın` |
| `change-email.html` | Change email address | `Yeni e-posta adresinizi doğrulayın` |

Kod (`{{ .Token }}`) taşıyan şablonlar — Magic link, Email OTP,
Reauthentication — bilerek yoktur: uygulama bu akışların hiçbirini
kullanmıyor (biriyle giriş, kodla giriş ve yeniden doğrulama yok; ayrıntı
aşağıda). Davet (Invite user) şablonu da yoktur: yöneticiler
`admin.auth.admin.createUser` ile `email_confirm: true` oluşturulur, davet
e-postası gönderilmez.

## Yapıştırma adımları

1. Supabase panosunda projeyi açın: **Authentication → Email Templates**.
2. Listeden şablonu seçin (önce **Confirm signup**).
3. **Subject** alanına yukarıdaki tablodaki konu satırını yazın.
4. Dosyanın **tüm içeriğini** kopyalayıp **Message body** alanına yapıştırın.
5. **Save** ile kaydedin.
6. Üç şablon için tekrarlayın.
7. Kendinize bir test kaydı açıp her e-postayı bir kez alıp bağlantıya
   tıklayın.

## Alan adı değişiminde yapılacaklar

Hiçbir şablonu ellemenize gerek yok. Panoda
**Authentication → URL Configuration → Site URL** alanını
`https://kabiaekolojik.com` yapmanız yeterli: logo dahil tüm mutlak
adresler `{{ .SiteURL }}` değişkeninden gelir. Site şu an
`*.vercel.app` adresinde çalışırken bu alan o adresi göstermelidir.

## Bağlantı biçimi

Şablonlar `{{ .ConfirmationURL }}` kullanır. Bunun nedeni: uygulamada
`token_hash` tüketen bir `/auth/confirm` (veya callback) rotası yoktur;
doğrulama Supabase'in kendi adresi üzerinden Site URL'e döner.
`token_hash` biçimine geçmek bu rota yazılmadan yapılırsa tüm
doğrulamalar sessizce çalışmaz. Rota eklenirse şablonlar da o gün
değişmelidir.

## Değişkenler

Her şablon yalnızca Supabase'in o şablon için belgelediği değişkenleri
kullanır: `{{ .ConfirmationURL }}`, `{{ .SiteURL }}`. Başka değişken
yoktur.
