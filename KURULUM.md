# Radar Uyarı — Kurulum Rehberi

Kişisel radar uyarı uygulaması. Radar yerlerini sen işaretlersin, yaklaşınca (varsayılan 2 km) sesli ve görsel uyarı verir. Ekran kapalıyken de çalışır.

## 1. Uygulamayı derle (GitHub)

1. Kod GitHub'a gönderildiğinde derleme kendiliğinden başlar.
2. GitHub'da depoya gir → üstte **Actions** sekmesi → en üstteki **iOS IPA** çalışmasına tıkla.
3. Yeşil ✔ olunca (yaklaşık 10 dakika) sayfanın altındaki **Artifacts** bölümünden **RadarUyari-ipa**'yı indir.
4. İnen `.zip` dosyasını aç, içinden **RadarUyari.ipa** çıkar.

Elle yeniden derlemek için: **Actions → iOS IPA → Run workflow**.

## 2. iPhone'a yükle (AltServer)

Not: Eylül 2026'dan beri Apple, Sideloadly'nin giriş yöntemini reddediyor (HTTP 503). Bu yüzden AltServer kullanıyoruz.

İlk kurulum (bir kez):
1. https://altstore.io → **AltServer for Windows** (altinstaller.zip) indir, kur. iTunes ve iCloud'un **web sürümü** kurulu olmalı (Microsoft Store sürümü değil).
2. AltServer'ı aç. Saatin yanındaki **^** içinde elmas simgesi belirir.
3. iPhone USB ile bağlıyken elmas simgesi → **Install AltStore → iPhone** → Apple ID ve şifre.

Radar Uyari'yı yükleme:
1. iPhone USB ile bağlı, kilidi açık.
2. **Shift** basılı tutarak elmas simgesine tıkla → **Sideload .ipa...** → **iPhone** → `RadarUyari.ipa`.
3. "Installation Succeeded" gelince bitti.

## 3. iPhone'da ilk ayarlar (bir kez)

1. **Geliştirici Modu:** Ayarlar → Gizlilik ve Güvenlik → en altta **Geliştirici Modu** → aç. Telefon yeniden başlar, açılınca **Aç** de.
2. **Sertifikaya güven:** Ayarlar → Genel → **VPN ve Aygıt Yönetimi** → Apple ID'ni seç → **Güven**.
3. Uygulamayı aç, **BAŞLAT**'a bas.
4. Konum izninde önce **Uygulamayı Kullanırken İzin Ver**, sonra iPhone ikinci kez sorduğunda **“Her Zaman”**'a geç.
   Sormazsa: Ayarlar → Radar Uyarı → Konum → **Her Zaman** ve **Kesin Konum** açık.
5. Bildirim iznine **İzin Ver**.

## 4. Kullanım

- **📍 RADAR İŞARETLE:** Bulunduğun yere radar ekler. Sürerken işaretlersen gidiş yönün de kaydedilir, karşı şeritte ötmez.
- **Haritaya uzun bas:** Oraya radar ekler (her iki yönde uyarır).
- **Radar silme:** Radara dokun → “Bu radarı sil”, ya da Menü → Radarlarım → Sil. Sen silmedikçe hiçbir radar silinmez.
- **◎ butonu:** Haritayı konumuna kilitler / bırakır.
- **Menü:** Uyarı mesafesi (1/2/3 km), sesli uyarı, yön filtresi, uyarı testi, yedekleme, çevrimdışı harita.

## 5. Her 7 günde bir yenileme

Ücretsiz Apple ID ile imza 7 gün geçerli. Süre dolunca uygulama açılmaz (radarların silinmez).

**Otomatik:** iTunes'ta telefon → Özet → **"Bu iPhone ile Wi-Fi üzerinden eşzamanla"** işaretli olsun. Bilgisayarda AltServer açık ve telefon aynı Wi-Fi'deyken AltStore arka planda kendiliğinden yeniler.

**Elle:** Telefonda **AltStore → My Apps → Refresh All** (AltServer açık, aynı Wi-Fi).

Uygulama yine de süresi dolarsa: AltServer → Shift + elmas → **Sideload .ipa...** ile aynı `RadarUyari.ipa`'yı tekrar yükle. Radarlar yerinde kalır.

## 6. Yedekler

- Her değişiklikte otomatik yedek: **Dosyalar → iPhone'umda → Radar Uyari → radarlar-yedek.json**
- Uygulama verisi bir şekilde silinirse, uygulama açılışta bu dosyayı bulup radarları geri yükler.
- Uygulamayı **silersen** bu klasör de silinir. Silmeden önce **Dışa aktar** ile dosyayı iCloud Drive'a veya bilgisayara kaydet. Sonra **İçe aktar** ile geri yüklersin.

## 7. Çevrimdışı harita

Menü → **Görünen alanı indir**. Haritayı indirmek istediğin bölgeye getirip yakınlaştır, sonra indir. Uzun güzergâhlar için yol boyunca birkaç parça halinde indir. Gezdiğin yerler de kendiliğinden kaydedilir.

İnternet yokken radar uyarısı yine çalışır (GPS internetsiz çalışır). İnternet gelince harita boşlukları kendiliğinden dolar.

## Sorun giderme

| Sorun | Çözüm |
|---|---|
| Ekran kapalıyken uyarmıyor | Ayarlar → Radar Uyarı → Konum → **Her Zaman**. Uygulamayı yukarı kaydırıp tamamen kapatma. |
| Ses gelmiyor | Telefonun sesi açık mı? Menü → Uyarıyı test et. |
| Uygulama açılmıyor | 7 gün dolmuş, AltStore → Refresh All ya da AltServer ile yeniden yükle. |
| Uygulama adı geçersiz hatası | Uygulama adında Türkçe karakter olmamalı (Radar Uyari). |
| Açılışta altta kırmızı HATA kutusu | Ekran görüntüsünü al, hatayı gösterir. |
| GPS kırmızı | Açık havada bekle, tünelde sinyal kesilir. |

Harita © OpenStreetMap katkıcıları.
