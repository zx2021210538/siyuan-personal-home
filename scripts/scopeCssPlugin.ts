import postcss, { type AtRule, type ChildNode, type Container, type Rule } from 'postcss';
import type { Plugin } from 'vite';

const LAYER_ORDER = ['properties', 'theme', 'base', 'components', 'utilities'] as const;
const SCOPE = '.sph-root';

function isInsideKeyframes(node: ChildNode): boolean {
  let curr: Container | undefined = node.parent;
  while (curr) {
    if (curr.type === 'atrule' && /keyframes$/i.test((curr as AtRule).name)) {
      return true;
    }
    curr = curr.parent as Container | undefined;
  }
  return false;
}

function scopeSingleSelector(raw: string): string {
  const sel = raw.trim();
  if (!sel) return sel;
  if (sel.includes(SCOPE)) return sel;
  if (sel === ':root' || sel === ':host' || sel === 'html' || sel === 'body') {
    return SCOPE;
  }
  if (sel === '*') {
    return `${SCOPE}, ${SCOPE} *`;
  }
  if (sel === ':before' || sel === '::before') {
    return `${SCOPE}::before, ${SCOPE} *::before`;
  }
  if (sel === ':after' || sel === '::after') {
    return `${SCOPE}::after, ${SCOPE} *::after`;
  }
  if (sel === '::backdrop') {
    return `${SCOPE} ::backdrop`;
  }
  return `${SCOPE} ${sel}`;
}

function scopeRule(rule: Rule): void {
  if (isInsideKeyframes(rule)) return;
  // Do not prefix nested CSS rules (e.g. `&:hover`) whose parent is already a scoped Rule.
  if (rule.parent && rule.parent.type === 'rule') return;
  const scoped = rule.selectors.map(scopeSingleSelector);
  rule.selectors = scoped;
}

function walkAndScope(container: Container): void {
  container.walkRules((rule) => {
    scopeRule(rule);
  });
}

/**
 * Unwraps all `@layer` blocks in canonical order (`properties -> theme -> base -> components -> utilities`)
 * and scopes every selector under `.sph-root`.
 *
 * Why this is required in SiYuan Note:
 * SiYuan's core desktop `base.css` contains unlayered rules like:
 *   `section, article, header, aside, nav { display: block }`,
 *   `h1..h6, p { margin: 0 }`,
 *   `button, input, select { font-family: var(--b3-font-family); font-size: 100%; line-height: normal }`,
 *   `img { height: auto }`,
 *   `svg { fill: currentColor }`.
 * Under CSS Cascade Layers, ANY unlayered rule beats EVERY `@layer` rule regardless of specificity.
 * Unlayering + scoping to `.sph-root` guarantees our plugin beats SiYuan's unlayered base resets
 * while keeping 100% isolation so nothing leaks into SiYuan's Protyle editor or other plugins.
 */
export function transformSphCss(css: string): string {
  const root = postcss.parse(css);

  const layerBuckets = new Map<string, ChildNode[]>();
  for (const name of LAYER_ORDER) {
    layerBuckets.set(name, []);
  }
  const topLevelAtRules: ChildNode[] = [];
  const otherUnlayered: ChildNode[] = [];

  for (const node of [...root.nodes]) {
    node.remove();

    if (node.type === 'atrule' && node.name === 'layer') {
      // Bare layer order declaration like `@layer theme, base, components, utilities;`
      if (!node.nodes || node.nodes.length === 0) {
        continue;
      }
      const layerName = node.params.trim();
      const bucket = layerBuckets.get(layerName) ?? otherUnlayered;
      for (const child of [...node.nodes]) {
        child.remove();
        bucket.push(child);
      }
      continue;
    }

    if (
      node.type === 'atrule' &&
      (node.name === 'property' || node.name === 'font-face' || /keyframes$/i.test(node.name))
    ) {
      topLevelAtRules.push(node);
      continue;
    }

    otherUnlayered.push(node);
  }

  const outRoot = postcss.root();
  for (const name of LAYER_ORDER) {
    const nodes = layerBuckets.get(name) ?? [];
    for (const n of nodes) {
      outRoot.append(n);
    }
  }
  for (const n of otherUnlayered) {
    outRoot.append(n);
  }

  walkAndScope(outRoot);

  for (const n of topLevelAtRules) {
    outRoot.append(n);
  }

  return outRoot.toString();
}

export function scopeSphCssVitePlugin(): Plugin {
  return {
    name: 'scope-and-unlayer-sph-css',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'asset' && fileName.endsWith('.css')) {
          const source =
            typeof chunk.source === 'string'
              ? chunk.source
              : Buffer.from(chunk.source).toString('utf-8');
          chunk.source = transformSphCss(source);
        }
      }
    },
  };
}
