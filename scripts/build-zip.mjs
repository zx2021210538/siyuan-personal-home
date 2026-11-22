import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const rootDir = path.resolve(import.meta.dirname, '..');
const distDir = path.join(rootDir, 'dist');
const outZip = path.join(rootDir, 'package.zip');

const requiredFiles = ['plugin.json', 'index.js', 'index.css'];
for (const rel of requiredFiles) {
  const full = path.join(distDir, rel);
  if (!fs.existsSync(full)) {
    console.error(`Missing required build artifact: ${full}`);
    process.exit(1);
  }
}

const zip = new JSZip();

function addDirToZip(dir, prefix = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const zipPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      addDirToZip(fullPath, zipPath);
    } else {
      zip.file(zipPath, fs.readFileSync(fullPath));
    }
  }
}

addDirToZip(distDir);
const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
fs.writeFileSync(outZip, buf);
console.log(`Built package.zip (${buf.length} bytes)`);
