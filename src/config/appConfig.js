/**
 * FONEX App Configuration
 */
export const AppConfig = {
    id: 'com.fonex.iptv.player',
    title: 'FONEX IPTV',
    version: '1.0.0',
    api: {
        tmdbKey: '', // Future integration
        updateUrl: 'https://api.fonexlabs.com/v1/update'
    },
    playback: {
        autoPlay: true,
        bufferLength: 30,
        lowLatency: true
    },
    ui: {
        defaultTheme: 'fonex-dark',
        splashDuration: 2500
    }
};

export default AppConfig;
