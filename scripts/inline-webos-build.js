import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist');
const indexPath = path.join(distDir, 'index.html');

try {
  await access(indexPath);
  const html = await readFile(indexPath, 'utf8');
  await writeFile(indexPath, html.replace(/\/+src\//g, './src/'), 'utf8');
  console.info('[build:webos] HTML yolları normalize edildi.');
} catch {
  console.warn('[build:webos] dist/index.html bulunamadi, adim atlandi.');
}
