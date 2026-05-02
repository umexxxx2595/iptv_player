export const library = {
  live: [
    {
      id: 'trt1',
      title: 'TRT 1 HD',
      category: 'Ulusal',
      type: 'live',
      streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      description: 'Canli yayin ve guncel program akisina hizli erisim.'
    },
    {
      id: 'fonex-sport',
      title: 'Fonex Spor',
      category: 'Spor',
      type: 'live',
      streamUrl: 'https://test-streams.mux.dev/test_001/stream.m3u8',
      description: 'Mac gunu odakli yayinlar ve spor icerikleri.'
    }
  ],
  movies: [
    {
      id: 'north-line',
      title: 'Kuzey Hatti',
      category: 'Aksiyon',
      type: 'movie',
      streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      description: 'Aksiyon seckisi icin hazir bir demo basligi.'
    },
    {
      id: 'deep-night',
      title: 'Derin Gece',
      category: 'Gerilim',
      type: 'movie',
      streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      description: 'VOD akisinin isledigini gosteren ornek icerik.'
    }
  ],
  series: [
    {
      id: 'step-file',
      title: 'Bozkir Dosyasi',
      category: 'Dizi',
      type: 'series',
      streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      description: 'Bolum bazli akis icin demo dizi kaydi.'
    }
  ]
};

export const navigationItems = [
  { route: 'home', label: 'Ana Sayfa' },
  { route: 'live', label: 'Canli TV' },
  { route: 'movies', label: 'Filmler' },
  { route: 'series', label: 'Diziler' },
  { route: 'favorites', label: 'Favoriler' },
  { route: 'settings', label: 'Ayarlar' }
];
