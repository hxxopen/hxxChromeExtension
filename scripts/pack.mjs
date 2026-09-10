import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const manifestPath = resolve(dist, 'manifest.json');

if (!existsSync(manifestPath)) {
  throw new Error('dist/manifest.json 不存在，请先执行 npm run build');
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const outDir = resolve(root, 'release');
mkdirSync(outDir, { recursive: true });

const zipName = `${manifest.name}-${manifest.version}.zip`;
const zipPath = resolve(outDir, zipName);
if (existsSync(zipPath)) rmSync(zipPath);

execFileSync('tar', ['-a', '-c', '-f', zipPath, '-C', dist, '.'], { stdio: 'inherit' });
console.log(`Packed ${zipPath}`);
