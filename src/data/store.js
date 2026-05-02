/**
 * State Management - Centralized App State
 */
class Store {
    constructor() {
        this.state = {
            playlists: JSON.parse(localStorage.getItem('fonex_playlists')) || [],
            favorites: JSON.parse(localStorage.getItem('fonex_favorites')) || [],
            settings: {
                theme: localStorage.getItem('fonex_theme') || 'fonex-dark',
                language: 'tr',
                performance: {
                    abr: true,
                    lowLatency: true,
                    hwAcceleration: true,
                    aiUpscaling: false
                }
            }
        };
        this.listeners = [];
    }

    getState() {
        return this.state;
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        if (newState.playlists) {
            localStorage.setItem('fonex_playlists', JSON.stringify(this.state.playlists));
        }
        if (newState.favorites) {
            localStorage.setItem('fonex_favorites', JSON.stringify(this.state.favorites));
        }
        this.notify();
    }

    setTheme(theme) {
        const overlay = document.getElementById('theme-overlay');
        if (overlay) {
            overlay.classList.add('active');
            setTimeout(() => {
                this.state.settings.theme = theme;
                localStorage.setItem('fonex_theme', theme);
                document.body.className = theme;
                this.notify();
                setTimeout(() => overlay.classList.remove('active'), 500);
            }, 400);
        } else {
            this.state.settings.theme = theme;
            localStorage.setItem('fonex_theme', theme);
            document.body.className = theme;
            this.notify();
        }
    }

    setPerformance(key, value) {
        this.state.settings.performance[key] = value;
        this.notify();
    }

    subscribe(listener) {
        this.listeners.push(listener);
    }

    notify() {
        this.listeners.forEach(l => l(this.state));
    }
}

export const store = new Store();
export default store;
