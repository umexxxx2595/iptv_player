import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Read package.json
const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
const version = packageJson.version;

// Update appinfo.json
const appinfoPath = join(rootDir, 'appinfo.json');
const appinfo = JSON.parse(readFileSync(appinfoPath, 'utf8'));
appinfo.version = version;
writeFileSync(appinfoPath, JSON.stringify(appinfo, null, 2) + '\n');

console.log(`✅ Version synced to ${version}`);
