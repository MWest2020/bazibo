// store/ is the source of the store texts and images; fastlane wants them in its own layout.
// This writes fastlane/metadata/{android,ios}/<locale>/ (gitignored) and checks the store limits.
//   node tools/store-to-fastlane.mjs          -> write the metadata
//   import { listing, fields } ...            -> used by tests/store.test.js
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const LOCALES = { nl: { play: 'nl-NL', apple: 'nl-NL' }, en: { play: 'en-US', apple: 'en-US' } };

// The listing headings per language (the number in brackets is the store's limit).
const HEADS = {
  nl: { name: 'Naam', subtitle: 'Ondertitel', short: 'Korte beschrijving', promo: 'Promotietekst', keywords: 'Trefwoorden', full: 'Beschrijving' },
  en: { name: 'Name', subtitle: 'Subtitle', short: 'Short description', promo: 'Promotional text', keywords: 'Keywords', full: 'Description' },
};
export const LIMITS = { name: 30, subtitle: 30, short: 80, promo: 170, keywords: 100, full: 4000 };

/** The sections of a listing file: heading text -> body. */
export function sections(md) {
  const out = {};
  let head = null;
  for (const line of md.split('\n')) {
    const m = line.match(/^## (.+)$/);
    if (m) head = m[1].trim();
    else if (head) out[head] = (out[head] ?? '') + line + '\n';
  }
  return out;
}

/** The store fields of one language: single-line fields take the first paragraph's first line. */
export function fields(md, lang) {
  const secs = sections(md);
  const find = (word) => Object.entries(secs).find(([h]) => h.startsWith(word))?.[1] ?? '';
  const out = {};
  for (const [key, word] of Object.entries(HEADS[lang])) {
    const body = find(word).trim();
    out[key] = key === 'full' ? body : body.split('\n')[0].trim();
  }
  return out;
}

export function listing(lang) {
  return fields(readFileSync(join(ROOT, 'store', `listing-${lang}.md`), 'utf8'), lang);
}

/** Problems with the limits, as readable lines; empty when all fit. */
export function check(f, lang) {
  return Object.entries(LIMITS)
    .filter(([k, max]) => !f[k] || [...f[k]].length > max)
    .map(([k, max]) => `${lang} ${k}: ${f[k] ? [...f[k]].length : 'missing'} (max ${max})`);
}

function write(dir, files) {
  mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text.trim() + '\n');
}

/** Copy the .png files of `from` into `to`, each name prefixed (deliver tells devices apart by
 * image size, but a shared folder needs distinct names or one set overwrites the other). */
export function copyShots(from, to, prefix = '') {
  mkdirSync(to, { recursive: true });
  for (const f of readdirSync(from).filter((n) => n.endsWith('.png')).sort()) copyFileSync(join(from, f), join(to, prefix + f));
}

export function main(out = join(ROOT, 'fastlane', 'metadata')) {
  rmSync(out, { recursive: true, force: true });
  const problems = [];
  for (const [lang, loc] of Object.entries(LOCALES)) {
    const f = listing(lang);
    problems.push(...check(f, lang));
    const shots = join(ROOT, 'store', 'screenshots', lang);
    // Google Play (fastlane supply)
    const play = join(out, 'android', loc.play);
    write(play, { 'title.txt': f.name, 'short_description.txt': f.short, 'full_description.txt': f.full });
    copyShots(join(shots, 'play-phone-1080x1920'), join(play, 'images', 'phoneScreenshots'));
    const feature = join(ROOT, 'store', lang === 'en' ? 'feature-graphic-en-1024x500.png' : 'feature-graphic-1024x500.png');
    copyFileSync(existsSync(feature) ? feature : join(ROOT, 'store', 'feature-graphic-1024x500.png'), join(play, 'images', 'featureGraphic.png'));
    copyFileSync(join(ROOT, 'store', 'play-icon-512.png'), join(play, 'images', 'icon.png'));
    // App Store (fastlane deliver)
    const ios = join(out, 'ios', loc.apple);
    write(ios, { 'name.txt': f.name, 'subtitle.txt': f.subtitle, 'promotional_text.txt': f.promo, 'keywords.txt': f.keywords, 'description.txt': f.full });
    copyShots(join(shots, 'appstore-iphone-6.9-1290x2796'), join(out, 'ios-screenshots', loc.apple), 'iphone-');
    copyShots(join(shots, 'appstore-ipad-13-2064x2752'), join(out, 'ios-screenshots', loc.apple), 'ipad-');
  }
  if (problems.length) {
    console.error('store texts over the limit:\n  ' + problems.join('\n  '));
    process.exitCode = 1;
    return false;
  }
  console.log(`fastlane metadata written to ${out}`);
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
