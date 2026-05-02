# FONEX IPTV

LG webOS TV ve modern tarayicilar icin hazirlanmis, odakli bir IPTV player iskeleti.

## Durum

Bu surum, bos veya kirik bir iskelet yerine acilabilen bir taban sunar:

- router ve ekran akisleri calisiyor
- sidebar, ana sayfa, browse, favoriler, ayarlar ve player ekranlari var
- ayarlar localStorage uzerinde saklaniyor
- favori ekleme ve cikarma yardimcilari hazir
- webOS dagitimi icin temel build scriptleri eklendi

## Kurulum

```bash
npm install
npm run dev
```

Uretim derlemesi:

```bash
npm run build:webos
```

## Test

```bash
npm test
```

## Proje Yapisi

- `src/app.js`: uygulama ayarlari ve saklama katmani
- `src/bootstrap.js`: router, focus ve tus yonetimi
- `src/boot-loader.js`: acilis orkestrasyonu
- `src/ui/`: ekranlar ve sidebar
- `src/utils/`: yardimci moduller
- `scripts/`: webOS build yardimcilari

## Sonraki Gelisim Alanlari

- gercek M3U veri akisi
- HLS.js ile gelismis player davranisi
- EPG entegrasyonu
- arama ve filtreleme
- webOS cihaz testleri
