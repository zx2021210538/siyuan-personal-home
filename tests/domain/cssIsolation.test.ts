import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('CSS isolation (no global Tailwind Preflight leak)', () => {
  it('omits Tailwind preflight import in src/styles/index.css so SiYuan host UI is untouched', () => {
    const cssPath = path.resolve(__dirname, '../../src/styles/index.css');
    const content = fs.readFileSync(cssPath, 'utf8');
    expect(content).toContain('@layer theme, base, components, utilities;');
    expect(content).not.toMatch(/@import\s+["']tailwindcss["']\s*;/);
    expect(content).toContain('tailwindcss/theme.css');
    expect(content).toContain('tailwindcss/utilities.css');
    expect(content).not.toContain('tailwindcss/preflight.css');
  });

  it('defines narrow-screen Bento ordering rules matching Spec section 5.2', () => {
    const cssPath = path.resolve(__dirname, '../../src/styles/index.css');
    const content = fs.readFileSync(cssPath, 'utf8');
    expect(content).toContain('display: contents');
    expect(content).toContain('.sph-order-today');
    expect(content).toContain('.sph-order-habits');
    expect(content).toContain('.sph-order-tasks');
    expect(content).toContain('.sph-order-calendar');
    expect(content).toContain('.sph-order-recent');
  });
});
