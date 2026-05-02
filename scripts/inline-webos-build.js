import fs from 'fs';
import path from 'path';

const distDir = path.resolve('dist');
const indexPath = path.join(distDir, 'index.html');

if (!fs.existsSync(indexPath)) {
    throw new Error('dist/index.html bulunamadı. Önce npm run build çalıştır.');
}

let html = fs.readFileSync(indexPath, 'utf8');

// CSS dosyalarını inline et
html = html.replace(
    /<link\s+rel="stylesheet"\s+[^>]*href="([^"]+\.css)"[^>]*>/g,
    (match, href) => {
        const cssPath = path.join(distDir, href.replace(/^\.\//, ''));
        if (!fs.existsSync(cssPath)) {
            console.warn('[inline-webos] CSS bulunamadı:', cssPath);
            return match;
        }

        const css = fs.readFileSync(cssPath, 'utf8');
        return `<style>\n${css}\n</style>`;
    }
);

// JS module dosyalarını inline et
html = html.replace(
    /<script\s+type="module"\s+[^>]*src="([^"]+\.js)"[^>]*><\/script>/g,
    (match, src) => {
        const jsPath = path.join(distDir, src.replace(/^\.\//, ''));
        if (!fs.existsSync(jsPath)) {
            console.warn('[inline-webos] JS bulunamadı:', jsPath);
            return match;
        }

        const js = fs.readFileSync(jsPath, 'utf8');
        return `<script type="module">\n${js}\n</script>`;
    }
);

// Vite crossorigin attribute kalıntılarını temizle
html = html.replace(/\s+crossorigin/g, '');

// Lucide CDN kalmışsa webOS için devre dışı bırak
html = html.replace(
    /<script[^>]+(?:lucide)[^>]*><\/script>/gi,
    `<script>window.lucide = window.lucide || { createIcons: function(){}, icons: {} };</script>`
);

fs.writeFileSync(indexPath, html, 'utf8');

console.log('[inline-webos] dist/index.html inline hale getirildi.');
