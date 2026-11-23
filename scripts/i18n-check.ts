/**
 * i18n:check — fails (exit 1) when:
 *  1. en.json and hi.json do not have exactly the same keys, or a value is empty or the same placeholders differ;
 *  2. a t('key') call uses a key missing from en.json;
 *  3. a screen or component has hard-coded text (JSX text or a label/title/placeholder string prop).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(__dirname, '..');
type Tree = { [k: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

const load = (file: string) => flatten(JSON.parse(readFileSync(join(root, 'i18n', file), 'utf8')) as Tree);
const en = load('en.json');
const hi = load('hi.json');
/** Full parity with en (bilingual baseline). */
const FULL = ['hi'] as const;
/** First-draft overlays: keys must exist in en; missing keys fall back to English at runtime. */
const PARTIAL = ['ta', 'zh', 'ko', 'ja'] as const;
const errors: string[] = [];

for (const key of Object.keys(en)) if (!(key in hi)) errors.push(`Missing in hi.json: ${key}`);
for (const key of Object.keys(hi)) if (!(key in en)) errors.push(`Missing in en.json: ${key}`);
for (const [lang, table] of [
  ['en', en],
  ['hi', hi],
] as const) {
  for (const [key, value] of Object.entries(table))
    if (!value.trim()) errors.push(`Empty value in ${lang}.json: ${key}`);
}
const placeholders = (s: string) =>
  (s.match(/{{\s*\w+\s*}}/g) ?? [])
    .map((p) => p.replace(/\s/g, ''))
    .sort()
    .join(',');
for (const key of Object.keys(en)) {
  if (key in hi && placeholders(en[key]) !== placeholders(hi[key]))
    errors.push(`Placeholders differ for ${key}`);
}

for (const lang of PARTIAL) {
  const table = load(`${lang}.json`);
  for (const key of Object.keys(table)) {
    if (!(key in en)) errors.push(`Unknown key in ${lang}.json: ${key}`);
    if (!table[key].trim()) errors.push(`Empty value in ${lang}.json: ${key}`);
    if (key in en && placeholders(en[key]) !== placeholders(table[key]))
      errors.push(`Placeholders differ for ${lang}.json ${key}`);
  }
}
void FULL;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (['node_modules', 'dist', '.expo', '.git'].includes(name)) return [];
    const p = join(dir, name);
    return statSync(p).isDirectory()
      ? walk(p)
      : /\.tsx?$/.test(name) && !/\.(test|d)\.tsx?$/.test(name)
        ? [p]
        : [];
  });
}

const UI_DIRS = ['app', 'features', 'ui'];
const TEXT_PROPS = 'label|title|placeholder|accessibilityLabel|accessibilityHint|hint|error|detail|action';
for (const dir of UI_DIRS) {
  let files: string[] = [];
  try {
    files = walk(join(root, dir));
  } catch {
    continue;
  }
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    const rel = relative(root, file);
    for (const m of src.matchAll(/t\(\s*['"]([\w.]+)['"]/g)) {
      if (!(m[1] in en)) errors.push(`${rel}: t('${m[1]}') is not in en.json`);
    }
    src.split('\n').forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
      const jsxText = />\s*[A-Za-zऀ-ॿ][^<>{}]*</.exec(line);
      const prop = new RegExp(`\\b(${TEXT_PROPS})=["'][^"']*[A-Za-zऀ-ॿ]`).exec(line);
      if (jsxText || prop) errors.push(`${rel}:${i + 1}: hard-coded text: ${trimmed.slice(0, 80)}`);
    });
  }
}

if (errors.length) {
  console.error(`i18n:check found ${errors.length} problem(s):\n` + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log(`i18n:check OK (${Object.keys(en).length} keys; en/hi full; ${PARTIAL.join('/')} overlays)`);
