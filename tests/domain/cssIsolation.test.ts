import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { transformSphCss } from '../../scripts/scopeCssPlugin';

describe('CSS isolation (no global Tailwind Preflight leak & unlayered SiYuan host resilience)', () => {
  it('omits Tailwind preflight import in src/styles/index.css so SiYuan host UI is untouched', () => {
    const cssPath = path.resolve(__dirname, '../../src/styles/index.css');
    const content = fs.readFileSync(cssPath, 'utf8');
    expect(content).toContain('@layer theme, base, components, utilities;');
    expect(content).not.toMatch(/@import\s+["']tailwindcss["']\s*;/);
    expect(content).toContain('tailwindcss/theme.css');
    expect(content).toContain('tailwindcss/utilities.css');
    expect(content).not.toContain('tailwindcss/preflight.css');
    expect(content).toContain('.sph-root svg.lucide');
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

  it('unwraps @layer blocks in canonical order and scopes all selectors under .sph-root', () => {
    const sample = `
      @layer theme, base, components, utilities;
      @layer theme { :root, :host { --spacing: 0.25rem; } }
      @layer base { .sph-root p { margin: 0; } }
      @layer components { .sph-notes-split { display: grid; } }
      @layer utilities { .flex { display: flex; } .mt-2 { margin-top: 0.5rem; } @media (min-width: 40rem) { .sm\\:px-10 { padding-inline: 2.5rem; } } }
      @keyframes spin { to { transform: rotate(360deg); } }
      @property --tw-translate-x { syntax: "*"; inherits: false; }
    `;
    const out = transformSphCss(sample);
    expect(out).not.toContain('@layer');
    expect(out).not.toContain(':root');
    expect(out).toContain('.sph-root { --spacing: 0.25rem; }');
    expect(out).toContain('.sph-root .sph-notes-split');
    expect(out).toContain('.sph-root .flex');
    expect(out).toContain('.sph-root .mt-2');
    expect(out).toContain('.sph-root .sm\\:px-10');
    expect(out).toContain('@keyframes spin');
    expect(out).toContain('@property --tw-translate-x');
    // Utilities must come AFTER base & components so `.sph-root .mt-2` beats `.sph-root p`
    expect(out.indexOf('.sph-root p')).toBeLessThan(out.indexOf('.sph-root .sph-notes-split'));
    expect(out.indexOf('.sph-root .sph-notes-split')).toBeLessThan(out.indexOf('.sph-root .flex'));
  });

  it('keeps sticky nav bar z-index strictly below SiYuan menus and toolbars', () => {
    const cssPath = path.resolve(__dirname, '../../src/styles/index.css');
    const content = fs.readFileSync(cssPath, 'utf8');
    const match = content.match(/\.sph-nav-bar\s*\{[^}]*z-index:\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBeLessThanOrEqual(5);
  });
});
