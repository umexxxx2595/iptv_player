/**
 * ============================================================================
 * Focus Layout – 2-D Spatial Navigation Engine
 * v38.2 – Clean, performant, TV-friendly.
 * Optimized for LG webOS and high-latency remote controls.
 * ============================================================================
 */

/* ----------------------------------------------------------------------
   PRIVATE STATE
   ---------------------------------------------------------------------- */
let opts = {
    container: document.body,
    wrap: false,
    focusClass: 'focus-visible',
    transitionDuration: 0
};

let focusables = [];   // Position map
let activeElement = null;
let keyHandler = null;
let mutationObserver = null;

/**
 * .focusable öğelerini tarar, konumlarını saklar.
 */
function buildMap() {
    const container = opts.container || document.body;
    const nodes = container.querySelectorAll('.focusable');
    focusables = [];

    nodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        
        // Görünürlük kontrolü
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || node.offsetParent === null) return;

        const rect = node.getBoundingClientRect();
        focusables.push({ el: node, rect });
    });
}

/**
 * Odak-sınıfını ekle
 */
function applyFocusClass(el) {
    if (opts.transitionDuration > 0) {
        el.style.transition = `outline ${opts.transitionDuration}ms ease, transform ${opts.transitionDuration}ms ease`;
    }
    el.classList.add(opts.focusClass);
}

/**
 * Odak-sınıfını kaldır
 */
function removeFocusClass(el) {
    el.classList.remove(opts.focusClass);
    el.style.transition = '';
}

/**
 * Aktif odak öğesini değiştirir.
 */
function setActive(el, emit = true) {
    if (!el || activeElement === el) return;

    if (activeElement) removeFocusClass(activeElement);
    activeElement = el;
    applyFocusClass(activeElement);
    
    // WebOS ve TV konforu için merkezi hizalama
    activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    activeElement.focus({ preventScroll: true });

    if (emit) {
        const ev = new CustomEvent('focus:change', {
            detail: { element: activeElement },
            bubbles: true,
            composed: true
        });
        activeElement.dispatchEvent(ev);
    }
}

/**
 * Yön tuşunu alıp en yakın odak öğesine geçiş yapar.
 */
function moveFocus(direction) {
    if (!activeElement) {
        buildMap();
        if (focusables.length > 0) setActive(focusables[0].el);
        return;
    }

    const currentRect = activeElement.getBoundingClientRect();
    let best = null;
    let bestScore = Infinity;

    focusables.forEach((item) => {
        if (item.el === activeElement) return;

        const r = item.rect;
        const dx = (r.left + r.width / 2) - (currentRect.left + currentRect.width / 2);
        const dy = (r.top + r.height / 2) - (currentRect.top + currentRect.height / 2);

        // Yön Filtreleme (Spatial Logic)
        const isCandidate = (
            (direction === 'ArrowRight' && dx > 0 && Math.abs(dy) < Math.abs(dx)) ||
            (direction === 'ArrowLeft'  && dx < 0 && Math.abs(dy) < Math.abs(dx)) ||
            (direction === 'ArrowDown'  && dy > 0 && Math.abs(dx) < Math.abs(dy)) ||
            (direction === 'ArrowUp'    && dy < 0 && Math.abs(dx) < Math.abs(dy))
        );

        if (!isCandidate) return;

        // Euclidean Distance
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < bestScore) {
            bestScore = distance;
            best = item;
        }
    });

    // Wrap Logic (Sınırları aşınca döngü)
    if (!best && opts.wrap && focusables.length) {
        const candidates = focusables.filter((item) => {
            const r = item.rect;
            if (direction === 'ArrowRight' || direction === 'ArrowLeft')
                return Math.abs(r.top - currentRect.top) < Math.max(currentRect.height, r.height) * 0.5;
            else
                return Math.abs(r.left - currentRect.left) < Math.max(currentRect.width, r.width) * 0.5;
        });

        if (candidates.length) {
            best = (direction === 'ArrowRight' || direction === 'ArrowDown')
                ? candidates[0]
                : candidates[candidates.length - 1];
        }
    }

    if (best) setActive(best.el);
}

/* ----------------------------------------------------------------------
   PUBLIC API
   ---------------------------------------------------------------------- */
export const focusLayout = {
    init(options = {}) {
        opts = { ...opts, ...options };
        buildMap();

        if (focusables.length && !activeElement) {
            setActive(focusables[0].el, false);
        }

        keyHandler = (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                moveFocus(e.key);
            }
        };

        document.addEventListener('keydown', keyHandler);
        
        // Dynamic content monitoring
        if (mutationObserver) {
            mutationObserver.disconnect();
        }
        mutationObserver = new MutationObserver(() => buildMap());
        mutationObserver.observe(opts.container || document.body, { childList: true, subtree: true });
    },

    refresh() {
        buildMap();
        if (activeElement && !document.body.contains(activeElement)) {
            if (focusables.length) setActive(focusables[0].el, false);
        }
    },

    setActive(el, emit = true) {
        setActive(el, emit);
    },

    getActive() {
        return activeElement;
    },

    destroy() {
        if (keyHandler) document.removeEventListener('keydown', keyHandler);
        if (mutationObserver) {
            mutationObserver.disconnect();
            mutationObserver = null;
        }
        if (activeElement) removeFocusClass(activeElement);
        focusables = [];
        activeElement = null;
    }
};
