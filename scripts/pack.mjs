import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const manifestPath = resolve(dist, 'manifest.json');

if (!existsSync(manifestPath)) {
  throw new Error('dist/manifest.json 不存在，请先执行 npm run build');
}

function listRelFiles(dir, prefix = '') {
  const files = [];
  for (const name of readdirSync(dir)) {
    const rel = prefix ? posix.join(prefix, name) : name;
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) {
      files.push(...listRelFiles(full, rel));
    } else {
      files.push(rel);
    }
  }
  return files;
}

const files = listRelFiles(dist);
if (!files.includes('manifest.json')) {
  throw new Error(`dist 中没有 manifest.json，当前文件：\n${files.join('\n')}`);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const outDir = resolve(root, 'release');
mkdirSync(outDir, { recursive: true });

const zipName = `${manifest.name}-${manifest.version}.zip`;
const zipPath = resolve(outDir, zipName);
if (existsSync(zipPath)) rmSync(zipPath);

// 必须列出具体文件，不能用 `.`：Windows tar 会把条目打成 ./manifest.json，
// Chrome 网上应用店只认 zip 根目录下的 manifest.json。
execFileSync('tar', ['-a', '-c', '-f', zipPath, '-C', dist, ...files], { stdio: 'inherit' });

const listing = execFileSync('tar', ['-tf', zipPath], { encoding: 'utf8' });
const entries = listing
  .split(/\r?\n/)
  .map((line) => line.trim().replace(/\\/g, '/').replace(/^\.\//, ''))
  .filter(Boolean);
const rawEntries = listing.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
const hasRootManifest = rawEntries.includes('manifest.json');

if (!hasRootManifest) {
  throw new Error(
    `zip 根目录没有 manifest.json（Chrome 网上应用店会拒绝上传）。\n当前条目：\n${rawEntries.join('\n')}`,
  );
}

if (!entries.includes('background.js') || !entries.includes('content.js')) {
  throw new Error(`zip 内容不完整。\n当前条目：\n${rawEntries.join('\n')}`);
}

console.log(`Packed ${zipPath}`);
console.log(`Root files:\n${rawEntries.join('\n')}`);
