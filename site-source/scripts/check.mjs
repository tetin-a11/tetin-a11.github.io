import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const files = [];
async function walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else files.push(full);
  }
}
await walk(root);
const htmlFiles = files.filter((file) => file.endsWith('.html'));
const errors = [];
for (const file of htmlFiles) {
  const html = await fs.readFile(file, 'utf8');
  const relative = path.relative(root, file);
  const checks = [
    [/<html lang="ja">/, 'lang="ja"'],
    [/<title>[^<]+<\/title>/, 'title'],
    [/<meta name="description" content="[^"]+">/, 'description'],
    [/<meta property="og:image"/, 'OG image'],
    [/<link rel="canonical"/, 'canonical'],
    [/<h1[ >]/, 'h1']
  ];
  for (const [pattern, label] of checks) if (!pattern.test(html)) errors.push(`${relative}: ${label} がありません`);
  if ((html.match(/<h1[ >]/g) || []).length !== 1) errors.push(`${relative}: h1が1件ではありません`);
  for (const match of html.matchAll(/(?:href|src)="([^"#?]+)(?:#[^"]*)?"/g)) {
    const ref = match[1];
    if (/^(https?:|mailto:|tel:)/.test(ref)) continue;
    const target = path.resolve(path.dirname(file), ref);
    const directoryIndex = path.join(target, 'index.html');
    if (!files.includes(target) && !files.includes(directoryIndex)) errors.push(`${relative}: リンク先がありません → ${ref}`);
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Checked ${htmlFiles.length} HTML pages: metadata, heading structure, internal assets/links OK`);
}
