# Radar Uyarı — Kurulum Rehberi

Kişisel radar uyarı uygulaması. Radar yerlerini sen işaretlersin, yaklaşınca (varsayılan 2 km) sesli ve görsel uyarı verir. Ekran kapalıyken de çalışır.

## 1. Uygulamayı derle (GitHub)

1. Kod GitHub'a gönderildiğinde derleme kendiliğinden başlar.
2. GitHub'da depoya gir → üstte **Actions** sekmesi → en üstteki **iOS IPA** çalışmasına tıkla.
3. Yeşil ✔ olunca (yaklaşık 10 dakika) sayfanın altındaki **Artifacts** bölümünden **RadarUyari-ipa**'yı indir.
4. İnen `.zip` dosyasını aç, içinden **RadarUyari.ipa** çıkar.

Elle yeniden derlemek için: **Actions → iOS IPA → Run workflow**.

## 2. iPhone'a yükle (Sideloadly)

1. iPhone'u USB ile bağla, kilidini aç.
2. Sideloadly'yi aç. **iDevice** kutusunda telefonun görünsün.
3. `RadarUyari.ipa` dosyasını Sideloadly'deki **IPA** simgesinin üzerine sürükle.
4. **Apple ID** kutusuna Apple ID e-postanı yaz, **Start**'a bas.
5. Şifreni Sideloadly'nin kendi penceresine gir (iki adımlı doğrulama kodu gelirse onu da gir).
6. "Done" yazınca yükleme bitti.

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

Ücretsiz Apple ID ile imza 7 gün geçerli. Süre dolunca uygulama açılmaz.

1. (Önerilir) Uygulamada Menü → **Dışa aktar** ile yedek al.
2. iPhone'u bağla, Sideloadly'de aynı `RadarUyari.ipa` ile aynı Apple ID'yi kullanıp **Start**.
3. Uygulama üstüne kurulur, radarların yerinde kalır.

İpucu: Sideloadly'de **Advanced Options → Automatic Refresh** açılırsa, bilgisayar açık ve telefon aynı Wi-Fi'deyken kendiliğinden yeniler.

## 6. Yedekler

- Her değişiklikte otomatik yedek: **Dosyalar → iPhone'umda → Radar Uyarı → radarlar-yedek.json**
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
| Uygulama açılmıyor | 7 gün dolmuş, Sideloadly ile yeniden yükle. |
| Sideloadly “Guru Meditation” / giriş hatası | Sideloadly'yi güncelle, iTunes ve iCloud'un web sürümü kurulu olsun. |
| GPS kırmızı | Açık havada bekle, tünelde sinyal kesilir. |

Harita © OpenStreetMap katkıcıları.
