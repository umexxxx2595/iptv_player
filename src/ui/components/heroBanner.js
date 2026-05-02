/**
 * Hero Banner Component (Class Based - Premium Version)
 */

export class HeroBanner {
    constructor(data = {}) {
        this.data = data;
    }

    /**
     * Renders the Hero Banner into a target element
     * @param {HTMLElement} target - Mount point
     */
    render(target) {
        if (!target) return;

        const title = this.data.title || 'FONEX IPTV';
        const description = this.data.description || 'Premium TV deneyimine hoş geldiniz.';
        const backdrop = this.data.backdropUrl || this.data.backdrop || '';

        const hero = document.createElement('header');
        hero.className = 'hero-banner fade-in';

        // 1. Backdrop
        const backdropEl = document.createElement('div');
        backdropEl.className = 'hero-backdrop';
        if (backdrop) {
            backdropEl.style.backgroundImage = `url(${backdrop})`;
        }

        // 2. Overlays
        const overlay = document.createElement('div');
        overlay.className = 'hero-overlay';

        // 3. Content
        const content = document.createElement('div');
        content.className = 'hero-content';

        const kicker = document.createElement('p');
        kicker.className = 'hero-kicker';
        kicker.textContent = this.data.tag || 'ÖNERİLEN';

        const titleEl = document.createElement('h1');
        titleEl.className = 'hero-title';
        titleEl.textContent = title;

        const descEl = document.createElement('p');
        descEl.className = 'hero-description';
        descEl.textContent = description;

        const actions = document.createElement('div');
        actions.className = 'hero-actions';

        if (this.data.actions) {
            this.data.actions.forEach(act => {
                const btn = document.createElement('button');
                btn.className = `btn-hero focusable ${act.primary ? 'primary' : ''}`;
                btn.innerHTML = `<i data-lucide="${act.icon}"></i> <span>${act.label}</span>`;
                btn.dataset.action = act.id;
                actions.appendChild(btn);
            });
        } else {
            // Default actions
            const playBtn = document.createElement('button');
            playBtn.className = 'btn-hero focusable primary';
            playBtn.innerHTML = '<i data-lucide="play"></i> <span>ŞİMDİ İZLE</span>';
            playBtn.dataset.action = 'watch-live';
            actions.appendChild(playBtn);
        }

        content.append(kicker, titleEl, descEl, actions);

        // Assembler
        hero.append(backdropEl, overlay, content);
        
        target.innerHTML = '';
        target.appendChild(hero);

        if (window.lucide?.createIcons) {
            window.lucide.createIcons();
        }
    }
}

export default HeroBanner;
