import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');
const distDir = path.join(rootDir, 'dist');
const pluginBaseDir = process.env.SIYUAN_PLUGIN_DIR || 'E:\\Siyuan_Vault\\data\\plugins';
const targetDir = path.join(pluginBaseDir, 'siyuan-personal-home');

if (!fs.existsSync(distDir)) {
  console.error('dist/ does not exist. Run `pnpm build` first.');
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });
fs.cpSync(distDir, targetDir, { recursive: true, force: true });
for (const file of ['README.md', 'README.zh-CN.md', 'LICENSE', 'preview.png']) {
  const src = path.join(rootDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(targetDir, file));
  }
}
console.log(`Installed siyuan-personal-home to ${targetDir}`);
