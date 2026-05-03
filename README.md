# 🎬 FONEX IPTV | Premium Streaming Experience

<div align="center">

![Uygulama Bannerı](public/assets/banners/readme-banner.png)

**LG webOS TV için geliştirilmiş, AI destekli premium IPTV player uygulaması**

[![Version](https://img.shields.io/badge/version-2.5.0-blue.svg)](https://github.com/umexxxx2595/iptv-player/releases)
[![webOS](https://img.shields.io/badge/webOS-4.0+-green.svg)](https://webostv.developer.lge.com/)
[![License](https://img.shields.io/badge/license-MIT-orange.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0-brightgreen.svg)](https://nodejs.org/)

[Özellikler](#-özellikler) • [Kurulum](#-kurulum) • [Kullanım](#-kullanım) • [webOS Deploy](#-webos-tv-deployment) • [Dokümantasyon](#-dokümantasyon)

</div>

---

## 📖 İçindekiler

- [Özellikler](#-özellikler)
- [Ekran Görüntüleri](#-ekran-görüntüleri)
- [Teknik Özellikler](#-teknik-özellikler)
- [Kurulum](#-kurulum)
- [Kullanım](#-kullanım)
- [webOS TV Deployment](#-webos-tv-deployment)
- [Proje Yapısı](#-proje-yapısı)
- [Geliştirme](#-geliştirme)
- [Test](#-test)
- [Troubleshooting](#-troubleshooting)
- [FAQ](#-faq)
- [Katkıda Bulunma](#-katkıda-bulunma)
- [Lisans](#-lisans)
- [İletişim](#-iletişim)

---

## ✨ Özellikler

### ✅ Mevcut Özellikler
| Özellik | Açıklama |
|---------|----------|
| 📺 **Canlı TV** | Binlerce kanal, M3U/M3U8 format desteği |
| 🎬 **VOD** | Film ve dizi arşivi |
| ❤️ **Favoriler** | Kanal ve içerik favorileme |
| 🕐 **Son İzlenenler** | İzleme geçmişi takibi |
| 🎮 **Remote Optimizasyonu** | Magic Remote tam desteği |
| 📱 **Multi-Device** | webOS TV + Tarayıcı desteği |

### 🗺️ Yol Haritası (Gelecek Özellikler)
| Özellik | Açıklama |
|---------|----------|
| 📅 **EPG** | 7 günlük elektronik program rehberi |
| 🔍 **Arama** | AI destekli akıllı arama sistemi |
| 🤖 **AI Öneriler** | İzleme alışkanlıklarına göre içerik önerileri |
| 👨‍👩‍👧‍👦 **Ebeveyn Denetimi** | PIN korumalı içerik filtreleme |
| 🎨 **Tema Motoru** | 5+ premium tema (Obsidian, Neon, Gold, vb.) |
| 🔐 **Güvenlik** | Stream şifreleme, güvenli storage |

### 🎨 UI/UX Özellikleri
- ✨ **Glassmorphism Design** - Modern cam efekti arayüz
- 🌊 **Smooth Animations** - 60 FPS akıcı geçişler
- 🎯 **Focus Management** - TV navigasyonu optimize
- 🌙 **Dark Mode** - Göz dostu koyu tema
- ♿ **Erişilebilirlik** - Sesli rehber desteği

---

## 📸 Ekran Görüntüleri

<div align="center">

| Ana Ekran | Video Oynatıcı | Ayarlar |
|-----------|----------------|---------|
| ![Ana Ekran](docs/screenshots/home.png) | ![Video Oynatıcı](docs/screenshots/player.png) | ![Ayarlar](docs/screenshots/settings.png) |

</div>

---

## ⚙️ Teknik Özellikler

### Teknoloji Stack

- **JavaScript** (React/Vanilla veya uygun framework) — %69.7
- **CSS** (Plain/Preprocessor) — %23.2
- **HTML** — %1.4
- **PowerShell** — Otomasyon ve dağıtım scriptleri (%4.3)
- **Diğer** — Yapılandırma/yardımcı dosyalar

> **Not:** Projenin tamamı [webOS Developer](https://webostv.developer.lge.com/) rehberliğinde hazırlanmıştır.

### Mimari
- Bileşen tabanlı frontend mimarisi
- Responsive ve Magic Remote uyumlu UI
- Gelişmiş hata yönetimi ve loglama

---

## 🛠️ Kurulum

```bash
git clone https://github.com/umexxxx2595/iptv_player.git
cd iptv_player

# Bağımlılıkları yükleyin
npm install

# Geliştirici modunda başlatın
npm run dev
```

---

## 🚀 Kullanım

- **M3U/M3U8** uzantılı oynatma listelerinizi arayüze sürükleyip bırakabilirsiniz.
- Favoriler veya geçmiş sekmesi üzerinden daha önce izlediğiniz içeriklere hızlı erişim sağlayın.
- Ayarlar menüsünden tema ve ebeveyn kontrol gibi ileri düzey seçeneklere ulaşabilirsiniz.

---

## 📺 webOS TV Deployment

1. webOS Geliştirici ortamını kurun (WebOS SDK, CLI).
2. LG Smart TV'nizi geliştirici moduna alın.
3. `npm run build` ile prodüksiyon derlemesini alın.
4. Uygulamayı SDK veya USB ile TV'ye deploy edin.
5. Kendi IPTV linkinizle giriş yapın.

---

## 📁 Proje Yapısı

```txt
iptv_player/
├── public/
│   ├── assets/
│   │   └── banners/
│   │       └── readme-banner.png
├── src/
│   ├── components/
│   ├── styles/
│   ├── utils/
├── docs/
│   └── screenshots/
│       ├── home.png
│       ├── player.png
│       └── settings.png
├── package.json
└── README.md
```

---

## 👩‍💻 Geliştirme

- Proje kodu ES6+ standartlarına uygun olarak yazılmıştır.
- Kod katkısı sağlamak için `dev` branch'ında çalışınız, PR gönderirken açıklayıcı commit mesajı giriniz.
- Kod stili için Prettier ve ESLint kullanılmaktadır.

---

## 🧪 Test

- Testler için:
    ```bash
    npm run test
    ```
- Her yeni özellik eklemeden önce ve sonra testleri çalıştırmayı unutmayınız.

---

## 🛟 Troubleshooting

- Giriş yapamıyorsanız M3U listenizin geçerli olduğundan emin olun.
- TV’de uygulama açılmıyorsa, geliştirici modunu ve ağ bağlantınızı kontrol edin.
- Sorun yaşarsanız [issue oluşturun](https://github.com/umexxxx2595/iptv_player/issues).

---

## ❓ FAQ

**Soru:** Hangi TV modellerinde çalışır?  
**Cevap:** webOS 4.0 ve üzeri LG Smart TV’lerde sorunsuz çalışır.

**Soru:** Birden fazla M3U playlist ekleyebilir miyim?  
**Cevap:** Evet, birden fazla kaynak eklenebilir.

---

## 🤝 Katkıda Bulunma

Katkı sağlamak için [CONTRIBUTING.md](CONTRIBUTING.md) dosyasını inceleyin ve `issue` veya `pull request` oluşturun.

---

## 📝 Lisans

Bu proje [MIT](LICENSE) lisansı ile lisanslanmıştır.

---

## 📬 İletişim

Her türlü soru, öneri ya da destek talepleriniz için GitHub üzerinden [issue açabilirsiniz](https://github.com/umexxxx2595/iptv_player/issues) veya mail gönderebilirsiniz: [umexxxx2595@gmail.com](mailto:umexxxx2595@gmail.com)
