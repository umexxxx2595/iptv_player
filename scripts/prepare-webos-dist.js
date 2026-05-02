import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist');
const markerPath = path.join(distDir, 'webos-build-ready.json');

await mkdir(distDir, { recursive: true });
await writeFile(
  markerPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      platform: 'webos',
      ready: true
    },
    null,
    2
  )
);

console.info('[build:webos] webOS output marker created.');
