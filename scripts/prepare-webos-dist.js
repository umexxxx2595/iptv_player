import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const distAssetsDir = path.join(distDir, 'assets');
const sourceAppinfoPath = path.join(rootDir, 'appinfo.json');
const distAppinfoPath = path.join(distDir, 'appinfo.json');
const indexPath = path.join(distDir, 'index.html');

function fail(message) {
    console.error(`[prepare-webos] ${message}`);
    process.exit(1);
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function copyRequiredAsset(fromRelative, toFileName) {
    const from = path.join(rootDir, fromRelative);
    const to = path.join(distAssetsDir, toFileName);

    if (!fs.existsSync(from)) {
        fail(`Required asset missing: ${fromRelative}`);
    }

    fs.copyFileSync(from, to);
    console.log(`[prepare-webos] copied ${fromRelative} -> dist/assets/${toFileName}`);
}

console.log('[prepare-webos] Starting post-build preparations...');

if (!fs.existsSync(distDir)) {
    fail('dist klasoru bulunamadi. Once vite build calismali.');
}

if (!fs.existsSync(sourceAppinfoPath)) {
    fail('appinfo.json bulunamadi.');
}

ensureDir(distAssetsDir);

copyRequiredAsset('public/assets/icons/icon.png', 'icon.png');
copyRequiredAsset('public/assets/icons/largeIcon.png', 'largeIcon.png');
copyRequiredAsset('public/assets/backgrounds/splash.png', 'splash.png');

const appinfo = JSON.parse(fs.readFileSync(sourceAppinfoPath, 'utf8'));

appinfo.icon = 'assets/icon.png';
appinfo.largeIcon = 'assets/largeIcon.png';
appinfo.splashBackground = 'assets/splash.png';

fs.writeFileSync(distAppinfoPath, JSON.stringify(appinfo, null, 4), 'utf8');
console.log('[prepare-webos] appinfo.json copied and paths fixed in dist/');

if (!fs.existsSync(indexPath)) {
    fail('dist/index.html bulunamadi.');
}

const indexHtml = fs.readFileSync(indexPath, 'utf8');

const hasExternalMainJs =
    indexHtml.includes('assets/main.js') ||
    indexHtml.includes('assets/index.js');

const hasExternalCss =
    indexHtml.includes('assets/main.css') ||
    indexHtml.includes('assets/style.css');

if (hasExternalMainJs || hasExternalCss) {
    fail('dist/index.html hala external JS/CSS referans ediyor. inline-webos-build.js kontrol edilmeli.');
}

console.log('[prepare-webos] dist/index.html looks clean. JS/CSS inlined.');
console.log('[prepare-webos] Preparation complete.');
