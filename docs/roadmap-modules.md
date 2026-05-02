# FONEX IPTV — Gelecek Modül Yol Haritası (Roadmap)

Aşağıdaki dosyalar, projenin mimari iskeletini oluşturmak üzere planlanmış ancak henüz kodlanmadıkları için (0 satır) ana üretim dizininden kaldırılmış ve buraya not edilmiştir. Bu modüller projenin bir sonraki aşamalarında sırayla hayata geçirilecektir.

## 🛠️ Planlanan Modüller

### Content & Streaming
- `src/content/contentManager.js`: İçerik önbellekleme ve yönetim mantığı.
- `src/content/streamResolver.js`: Alternatif yayın linklerini (backup links) çözümleme.

### i18n (Uluslararasılaştırma)
- `src/i18n/languageManager.js`: Çoklu dil desteği yönetimi.
- `src/i18n/localizationEngine.js`: Dinamik metin çeviri motoru.

### Metadata & Entegrasyon
- `src/metadata/tmdbIntegration.js`: Film/Dizi bilgilerini TMDB üzerinden çekme.
- `src/metadata/metadataResolver.js`: M3U verilerini zenginleştirme.
- `src/metadata/castAndCrew.js`: Oyuncu ve ekip bilgilerini işleme.
- `src/metadata/seriesGrouping.js`: Sezon/Bölüm gruplandırma mantığı.
- `src/metadata/trailerFetcher.js`: Fragman linklerini bulma.

### Native & WebOS
- `src/native/webosBridge.js`: LG WebOS API'leri ile doğrudan iletişim.
- `src/native/hardwareAcceleration.js`: Donanım tabanlı video hızlandırma ayarları.
- `src/native/powerManagement.js`: TV güç tasarrufu ve ekran koruyucu kontrolü.
- `src/native/systemIntegration.js`: TV sistem ayarları entegrasyonu.

### Player (Oynatıcı Geliştirmeleri)
- `src/player/adaptiveQuality.js`: İnternet hızına göre otomatik kalite ayarı.
- `src/player/recoveryEngine.js`: Yayın kopmalarında otomatik kurtarma.
- `src/player/preloadBuffer.js`: Bir sonraki kanalın önceden yüklenmesi (Zap süresini düşürmek için).
- `src/player/instantZap.js`: Kanal geçiş hızını maksimize eden motor.
- `src/player/dashEngine.js`: DASH (mpd) yayını desteği.
- `src/player/html5Engine.js`: Standart HTML5 video fallback'leri.
- `src/player/audioSync.js`: Ses/Görüntü senkronizasyon araçları.

### Remote & Kontrol
- `src/remote/gestureRecognition.js`: Magic Remote el hareketleri desteği.
- `src/remote/pointerPrecision.js`: Fare imleci hassasiyet ayarları.

### Network
- `src/network/bandwidthManager.js`: Bant genişliği izleme ve kısıtlama.
- `src/network/connectionOptimizer.js`: Bağlantı stabilitesini artırma.
- `src/network/multiPathStreaming.js`: Çok yollu streaming desteği.

### Security
- `src/security/encryptionEngine.js`: Yayın/Veri şifreleme motoru.
- `src/security/secureStorage.js`: Kullanıcı verilerinin güvenli saklanması.
- `src/security/contentFiltering.js`: Zararlı içerik filtreleme.

### Storage & State
- `src/storage/stateSnapshot.js`: Uygulama durumunun anlık yedeği.
- `src/storage/quotaManager.js`: Yerel depolama limit yönetimi.
- `src/storage/garbageCollector.js`: Gereksiz verileri temizleme.

### Parental Control (Ebeveyn Denetimi)
- `src/parental/pinManager.js`: PIN kodu yönetimi.
- `src/parental/categoryLocker.js`: Kategori bazlı kilitleme.
- `src/parental/contentMasking.js`: Yetişkin içerikleri gizleme.
- `src/parental/timeLimits.js`: İzleme süresi kısıtlamaları.

### Personalization
- `src/personalization/userProfile.js`: Çoklu profil desteği.
- `src/personalization/preferenceLearning.js`: İzleme alışkanlığı analizi.
- `src/personalization/adaptiveInterface.js`: Kullanıcıya özel UI düzeni.

### Workers (Arka Plan İşçileri)
- `src/workers/epgParser.worker.js`: Dev EPG verilerini arka planda işleme.
- `src/workers/imagePreloader.worker.js`: Görselleri belleğe önceden alma.
- `src/workers/searchIndexer.worker.js`: Hızlı arama için indeksleme.

---
*Not: Bu liste, projenin büyüme vizyonunu temsil eder. İhtiyaç duyuldukça dosyalar ilgili dizinlerde tekrar oluşturulacaktır.*
