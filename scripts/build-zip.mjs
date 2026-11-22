import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const rootDir = path.resolve(import.meta.dirname, '..');
const distDir = path.join(rootDir, 'dist');
const outZip = path.join(rootDir, 'package.zip');

const MAX_ICON_BYTES = 64 * 1024;
const MAX_PREVIEW_BYTES = 512 * 1024;

const requiredDistFiles = ['plugin.json', 'index.js', 'index.css', 'icon.png'];
for (const rel of requiredDistFiles) {
  const full = path.join(distDir, rel);
  if (!fs.existsSync(full)) {
    console.error(`Missing required build artifact: ${full}`);
    process.exit(1);
  }
}

const iconSize = fs.statSync(path.join(distDir, 'icon.png')).size;
if (iconSize > MAX_ICON_BYTES) {
  console.error(`icon.png (${iconSize} B) exceeds SiYuan bazaar limit (${MAX_ICON_BYTES} B)`);
  process.exit(1);
}

const rootBundleFiles = ['README.md', 'README.zh-CN.md', 'LICENSE', 'preview.png'];
for (const rel of rootBundleFiles) {
  const full = path.join(rootDir, rel);
  if (!fs.existsSync(full)) {
    console.error(`Missing required root package file: ${full}`);
    process.exit(1);
  }
}

const previewSize = fs.statSync(path.join(rootDir, 'preview.png')).size;
if (previewSize > MAX_PREVIEW_BYTES) {
  console.error(`preview.png (${previewSize} B) exceeds SiYuan bazaar limit (${MAX_PREVIEW_BYTES} B)`);
  process.exit(1);
}

const zip = new JSZip();

function addDirToZip(dir, prefix = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const zipPath = (prefix ? `${prefix}/${entry.name}` : entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      addDirToZip(fullPath, zipPath);
    } else {
      zip.file(zipPath, fs.readFileSync(fullPath));
    }
  }
}

addDirToZip(distDir);
for (const rel of rootBundleFiles) {
  zip.file(rel, fs.readFileSync(path.join(rootDir, rel)));
}

const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
fs.writeFileSync(outZip, buf);
console.log(
  `Built package.zip (${buf.length} bytes, icon=${iconSize} B, preview=${previewSize} B)`,
);
