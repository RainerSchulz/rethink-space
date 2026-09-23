/**
 * Schreibt einen CMS-Export zurück in die Website. Aufruf:
 *   npm run content:apply -- [pfad/zu/site-content.json] [--dry]
 *
 * Ohne Pfad sucht das Skript der Reihe nach: ./site-content.json,
 * ../rethink-cms/site-content.json und die neueste Datei dieses Namens im
 * Downloads-Ordner — dort landet der Export aus dem Browser.
 *
 * Geschrieben werden:
 *   src/site/i18n/en.js   Werte der im Export enthaltenen Schlüssel
 *   src/site/i18n/de.js   dito; fehlt ein deutscher Text, kommt der englische
 *                         hinein, damit der Paritätstest hält (der Editor
 *                         zeigt nur noch Englisch)
 *   pages/<slug>/index.html
 *                         der englische Text an jedem data-i18n-Element (der
 *                         Test vergleicht ihn mit en.js) und die Bildpfade
 *
 * Grundsätze:
 *   - Nur was im Export steht wird angefasst. Unbekannte Schlüssel werden
 *     gemeldet, nicht angelegt — neue Schlüssel gehören in den Code.
 *   - Zweimal laufen lassen ändert nichts mehr (idempotent).
 *
 * Die Umformungen stehen in scripts/lib/apply.mjs und sind dort getestet.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { setDictValue, hasDictKey, applyKeyToHtml, setImages } from './lib/apply.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const given = args.find((a) => !a.startsWith('--'));

/* ---------- Export finden ---------- */
function newestInDownloads() {
  const home = process.env.USERPROFILE || process.env.HOME;
  const dir = home && join(home, 'Downloads');
  if (!dir || !existsSync(dir)) return null;
  const hits = readdirSync(dir)
    .filter((f) => /^site-content(\s*\(\d+\))?\.json$/i.test(f))
    .map((f) => ({ file: join(dir, f), at: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.at - a.at);
  return hits[0]?.file ?? null;
}

const source = given
  ? resolve(given)
  : [join(ROOT, 'site-content.json'), resolve(ROOT, '../rethink-cms/site-content.json')]
    .find(existsSync) ?? newestInDownloads();

if (!source || !existsSync(source)) {
  console.error('Kein Export gefunden. Im CMS unter „Veröffentlichen“ herunterladen und den Pfad angeben:');
  console.error('  npm run content:apply -- "C:/Users/<du>/Downloads/site-content.json"');
  process.exit(1);
}

const content = JSON.parse(readFileSync(source, 'utf8'));
if (!Array.isArray(content.pages)) {
  console.error(`${source}: kein CMS-Export (Feld "pages" fehlt).`);
  process.exit(1);
}

const notes = [];
let dictChanges = 0;
let htmlChanges = 0;
let imageChanges = 0;

/* ---------- Wörterbücher ---------- */
const dicts = {
  en: { file: join(ROOT, 'src/site/i18n/en.js'), lines: null },
  de: { file: join(ROOT, 'src/site/i18n/de.js'), lines: null },
};
for (const d of Object.values(dicts)) d.lines = readFileSync(d.file, 'utf8').split('\n');

const enByKey = new Map();
for (const page of content.pages) {
  for (const k of page.keys ?? []) {
    if (typeof k.en !== 'string' || !k.en.trim()) {
      notes.push(`${page.slug}: ${k.key} hat keinen englischen Text — übersprungen`);
      continue;
    }
    if (!hasDictKey(dicts.en.lines, k.key)) {
      notes.push(`${page.slug}: Schlüssel ${k.key} gibt es in en.js nicht — übersprungen`);
      continue;
    }
    enByKey.set(k.key, k.en);
    if (setDictValue(dicts.en.lines, k.key, k.en)) dictChanges++;
    // Kein deutscher Text? Dann den englischen, damit beide Wörterbücher
    // dieselben Schlüssel mit Inhalt tragen (tests/unit/i18n.test.js).
    const de = typeof k.de === 'string' && k.de.trim() ? k.de : k.en;
    if (setDictValue(dicts.de.lines, k.key, de)) dictChanges++;
  }
}

/* ---------- Seiten ---------- */
for (const page of content.pages) {
  if (page.slug === 'global') continue;
  const file = join(ROOT, `pages/${page.slug}/index.html`);
  if (!existsSync(file)) { notes.push(`Seite ${page.slug} gibt es nicht mehr — übersprungen`); continue; }
  let html = readFileSync(file, 'utf8');
  const before = html;

  for (const k of page.keys ?? []) {
    const en = enByKey.get(k.key);
    if (en === undefined) continue;
    const r = applyKeyToHtml(html, k.key, en);
    html = r.html;
    htmlChanges += r.changed;
  }

  const img = setImages(html, page.images ?? []);
  if (img.skipped) notes.push(`${page.slug}: ${img.skipped} — Bilder übersprungen`);
  html = img.html;
  imageChanges += img.changed;

  if (html !== before && !DRY) writeFileSync(file, html);
}

if (!DRY) for (const d of Object.values(dicts)) writeFileSync(d.file, d.lines.join('\n'));

/* ---------- Bericht ---------- */
console.log(`Export: ${source}`);
console.log(`Seiten im Export: ${content.pages.length}`);
console.log(`Wörterbuch-Werte geändert: ${dictChanges}`);
console.log(`Texte in Shells geändert:  ${htmlChanges}`);
console.log(`Bildpfade geändert:        ${imageChanges}`);
if (notes.length > 0) {
  console.log(`\nHinweise (${notes.length}):`);
  for (const n of notes) console.log(`  - ${n}`);
}
if (DRY) console.log('\n--dry: nichts geschrieben.');
else console.log('\nJetzt prüfen: npm run lint && npm run test:run && npm run build');
