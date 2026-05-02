/**
 * FONEX Theme Presets
 * Immutable theme catalog.
 */

const PRESETS = {
    obsidian: {
        id: 'obsidian',
        name: 'Obsidian (Elite)',
        vars: {
            '--v-bg-pure': '#000000',
            '--v-bg-deep': '#050508',
            '--v-fg-primary': '#E0E0E0',
            '--v-fg-secondary': '#A0A0A0',
            '--v-accent': '#00F2FF',
            '--v-accent-glow': 'rgba(0,242,255,0.4)',
            '--v-accent-soft': 'rgba(0,242,255,0.15)',
            '--v-secondary': '#7000FF'
        },
        preview: './assets/theme-preview/obsidian.png',
        meta: {
            description: 'Koyu, yüksek kontrast ve neon-mavi vurgu.',
            author: 'FONEX Design Lab'
        }
    },

    neon: {
        id: 'neon',
        name: 'Cyber Neon',
        vars: {
            '--v-bg-pure': '#0A0A0F',
            '--v-bg-deep': '#0D0D15',
            '--v-fg-primary': '#E0FFE0',
            '--v-fg-secondary': '#A0FFA0',
            '--v-accent': '#FF00FF',
            '--v-accent-glow': 'rgba(255,0,255,0.45)',
            '--v-accent-soft': 'rgba(255,0,255,0.15)',
            '--v-secondary': '#00F2FF'
        },
        preview: './assets/theme-preview/neon.png',
        meta: {
            description: 'Sibernetik neon ışıkları ve parlak magenta vurgular.',
            author: 'FONEX Design Lab'
        }
    },

    gold: {
        id: 'gold',
        name: 'Golden Cinema',
        vars: {
            '--v-bg-pure': '#0F0E0A',
            '--v-bg-deep': '#1A1812',
            '--v-fg-primary': '#FFF9E6',
            '--v-fg-secondary': '#EED9A6',
            '--v-accent': '#FFD700',
            '--v-accent-glow': 'rgba(255,215,0,0.35)',
            '--v-accent-soft': 'rgba(255,215,0,0.12)',
            '--v-secondary': '#FFA500'
        },
        preview: './assets/theme-preview/gold.png',
        meta: {
            description: 'Klasik sinema salonunu anımsatan sıcak altın ışıltısı.',
            author: 'FONEX Design Lab'
        }
    },

    midnight: {
        id: 'midnight',
        name: 'Midnight',
        vars: {
            '--v-bg-pure': '#0A0B14',
            '--v-bg-deep': '#131522',
            '--v-fg-primary': '#D8D8FF',
            '--v-fg-secondary': '#9090C0',
            '--v-accent': '#C41AFF',
            '--v-accent-glow': 'rgba(196,26,255,0.4)',
            '--v-accent-soft': 'rgba(196,26,255,0.15)',
            '--v-secondary': '#6000FF'
        },
        preview: './assets/theme-preview/midnight.png',
        meta: {
            description: 'Gece gökyüzü ve kozmik mor-kırmızı etkileri.',
            author: 'FONEX Design Lab'
        }
    },

    crystal: {
        id: 'crystal',
        name: 'Crystal Light',
        vars: {
            '--v-bg-pure': '#F9F9FC',
            '--v-bg-deep': '#EDEFF5',
            '--v-fg-primary': '#212121',
            '--v-fg-secondary': '#606060',
            '--v-accent': '#8B5CF6',
            '--v-accent-glow': 'rgba(139,92,246,0.30)',
            '--v-accent-soft': 'rgba(139,92,246,0.10)',
            '--v-secondary': '#6C4BE6'
        },
        preview: './assets/theme-preview/crystal.png',
        meta: {
            description: 'Açık renk paleti, hafif gölgeler ve pastel mor.',
            author: 'FONEX Design Lab'
        }
    }
};

function deepFreezeTheme(theme) {
    if (theme.vars) Object.freeze(theme.vars);
    if (theme.meta) Object.freeze(theme.meta);
    return Object.freeze(theme);
}

export const themePresets = Object.freeze(
    Object.fromEntries(
        Object.entries(PRESETS).map(([id, preset]) => [id, deepFreezeTheme({ ...preset })])
    )
);

export const getTheme = (id) => {
    if (!id || typeof id !== 'string') return themePresets.obsidian;
    return themePresets[id] ?? themePresets.obsidian;
};

export const listThemes = () => Object.values(themePresets);
