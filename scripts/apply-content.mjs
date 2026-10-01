/**
 * Schreibt den Inhaltsstand des CMS zurück in die Website. Aufruf:
 *   npm run content:apply -- [pfad/zu/site-content.json] [--dry]
 *   npm run content:apply -- --from-supabase            (für den GitHub-Lauf)
 *
 * Mit --from-supabase wird nicht aus einer Datei gelesen, sondern direkt aus
 * den CMS-Tabellen (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). So kann der
 * Veröffentlichen-Knopf im CMS den Build auslösen, ohne dass jemand eine
 * Datei herunterlädt und weiterreicht.
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
 *   public/Bilder/cms/    Bilder aus der CMS-Medienbibliothek (Bucket „media“),
 *                         die eine Seite oder Kachel jetzt nutzt
 *
 * Kacheln (page.bands, Tabelle cms_bands): der Bereich <!-- cms:bands --> wird
 * nach der Liste des CMS neu zusammengesetzt — hinzufügen, löschen, verschieben
 * (scripts/lib/bands.mjs). Nur dafür werden Schlüssel angelegt bzw. entfernt,
 * und nur mit dem Muster <präfix>.band.<id> / <präfix>.panel.<id>.text.
 *
 * Grundsätze:
 *   - Nur was im Export steht wird angefasst. Unbekannte Schlüssel werden
 *     gemeldet, nicht angelegt — neue Schlüssel gehören in den Code
 *     (Ausnahme: Schlüssel neuer Kacheln, siehe oben).
 *   - Zweimal laufen lassen ändert nichts mehr (idempotent).
 *
 * Die Umformungen stehen in scripts/lib/apply.mjs und sind dort getestet.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { setDictValue, hasDictKey, setImages, sharedKeys, applyKeysToHtml, setRows } from './lib/apply.mjs';
import { ladeInhalt } from './lib/cms-fetch.mjs';
import { splitRegion, parseBands, applyBands, insertDictKeys, removeDictKey, prefixOf, maskRegion } from './lib/bands.mjs';
import { resolveImage } from './lib/cms-images.mjs';
import { toSnapshot } from './lib/snapshot.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const AUS_SUPABASE = args.includes('--from-supabase');
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

let content;
let source;
if (AUS_SUPABASE) {
  source = 'Supabase (cms_pages, cms_texts, cms_images, cms_bands)';
  try {
    content = await ladeInhalt({
      url: process.env.SUPABASE_URL,
      key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
  } catch (err) {
    console.error('Inhalt aus Supabase holen fehlgeschlagen:', err.message);
    process.exit(1);
  }
} else {
  source = given
    ? resolve(given)
    : [join(ROOT, 'site-content.json'), resolve(ROOT, '../rethink-cms/site-content.json')]
      .find(existsSync) ?? newestInDownloads();

  if (!source || !existsSync(source)) {
    console.error('Kein Export gefunden. Im CMS unter „Veröffentlichen“ herunterladen und den Pfad angeben:');
    console.error('  npm run content:apply -- "C:/Users/<du>/Downloads/site-content.json"');
    console.error('Oder direkt aus der Datenbank lesen:');
    console.error('  npm run content:apply -- --from-supabase');
    process.exit(1);
  }
  content = JSON.parse(readFileSync(source, 'utf8'));
}

if (!Array.isArray(content.pages)) {
  console.error(`${source}: kein CMS-Inhalt (Feld "pages" fehlt).`);
  process.exit(1);
}

const notes = [];
let dictChanges = 0;
let htmlChanges = 0;
let imageChanges = 0;
let bandChanges = 0;
let dictKeysAdded = 0;
let dictKeysRemoved = 0;
let downloads = 0;

const pageFile = (slug) => (slug === 'landing' ? join(ROOT, 'index.html') : join(ROOT, `pages/${slug}/index.html`));
const KEY_RE = /^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/; // wie tests/unit/i18n.test.js
const BILDER_CMS = join(ROOT, 'public/Bilder/cms');

/** Bildpfad aus dem CMS → Website-Pfad; Bucket-Bilder werden heruntergeladen. */
async function imagePath(src) {
  const r = await resolveImage(src, {
    supabaseUrl: process.env.SUPABASE_URL,
    dir: BILDER_CMS,
    dry: DRY,
    exists: existsSync,
    write: (file, data) => { mkdirSync(BILDER_CMS, { recursive: true }); writeFileSync(file, data); },
  });
  if (r.note) notes.push(r.note);
  if (r.downloaded) downloads++;
  return r.src;
}

/* ---------- Wörterbücher ---------- */
const dicts = {
  en: { file: join(ROOT, 'src/site/i18n/en.js'), lines: null },
  de: { file: join(ROOT, 'src/site/i18n/de.js'), lines: null },
};
for (const d of Object.values(dicts)) d.lines = readFileSync(d.file, 'utf8').split('\n');

/* ---------- Kacheln: Schlüssel neuer Kacheln anlegen, gelöschter entfernen ---------- */
for (const page of content.pages) {
  if (!Array.isArray(page.bands)) continue;
  const file = pageFile(page.slug);
  if (!existsSync(file)) continue;
  const parts = splitRegion(readFileSync(file, 'utf8'));
  if (!parts) {
    // Das CMS liefert für jede Seite eine (meist leere) Liste; nur echte Kacheln ohne Bereich sind ein Problem.
    if (page.bands.length) notes.push(`${page.slug}: Kacheln im Export, aber kein Bereich <!-- cms:bands --> in der Seite`);
    page.bands = undefined;
    continue;
  }
  const existing = parseBands(parts.region);
  const keys = new Map((page.keys ?? []).map((k) => [k.key, k]));
  const prefix = prefixOf(existing[0]?.titleKey ?? page.bands[0]?.titleKey);

  page.bands = page.bands.filter((b) => {
    const ok = /^[a-z0-9-]+$/.test(b.id ?? '')
      && b.titleKey === `${prefix}.band.${b.id}` && b.textKey === `${prefix}.panel.${b.id}.text`
      && KEY_RE.test(b.titleKey) && KEY_RE.test(b.textKey);
    if (!ok) notes.push(`${page.slug}: Kachel „${b.id}“ hat ungültige Schlüssel — übersprungen`);
    return ok;
  });

  for (const b of page.bands) {
    if (existing.some((e) => e.id === b.id)) continue;
    const title = keys.get(b.titleKey);
    const text = keys.get(b.textKey);
    const en = (k, fallback) => (k?.en?.trim() ? k.en : fallback);
    const de = (k, fallback) => (k?.de?.trim() ? k.de : en(k, fallback));
    // Leere Texte verbietet das CMS schon; hier nur das Netz, damit der Paritätstest hält.
    dictKeysAdded += insertDictKeys(dicts.en.lines, [
      { key: b.titleKey, value: en(title, b.id) }, { key: b.textKey, value: en(text, en(title, b.id)) },
    ], `${prefix}.`);
    insertDictKeys(dicts.de.lines, [
      { key: b.titleKey, value: de(title, b.id) }, { key: b.textKey, value: de(text, en(title, b.id)) },
    ], `${prefix}.`);
  }
  for (const e of existing) {
    if (page.bands.some((b) => b.id === e.id)) continue;
    for (const key of [e.titleKey, e.textKey]) {
      if (removeDictKey(dicts.en.lines, key)) dictKeysRemoved++;
      removeDictKey(dicts.de.lines, key);
    }
  }
}

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
  // Die Startseite liegt in der Wurzel, alle anderen unter pages/<slug>/.
  const file = pageFile(page.slug);
  if (!existsSync(file)) { notes.push(`Seite ${page.slug} gibt es nicht mehr — übersprungen`); continue; }
  let html = readFileSync(file, 'utf8');
  const before = html;

  // Kacheln zuerst: danach stehen alle Elemente da, deren Texte unten gesetzt werden.
  if (Array.isArray(page.bands)) {
    const bands = [];
    for (const b of page.bands) {
      // Ohne Bild ist erlaubt (dunkle Fläche, band--plain); ein angegebenes, aber
      // unbrauchbares Bild wird übersprungen — sonst verschwände die Kachel still.
      if (!b.image?.src) { bands.push({ ...b, image: { src: null } }); continue; }
      const src = await imagePath(b.image.src);
      if (!src) { notes.push(`${page.slug}: Kachel „${b.id}“ ohne gültiges Bild — übersprungen`); continue; }
      bands.push({ ...b, image: { ...b.image, src } });
    }
    const r = applyBands(html, bands, (key) => enByKey.get(key));
    if (r.skipped) notes.push(`${page.slug}: ${r.skipped}`);
    html = r.html;
    if (r.changed) bandChanges++;
  }

  const own = applyKeysToHtml(html, page.keys ?? [], (key) => enByKey.get(key));
  html = own.html;
  htmlChanges += own.changed;
  // Im CMS entfernte Zeilen (data-cms-row, z. B. Bücher auf People)
  const rows = setRows(html, page.keys ?? []);
  html = rows.html;
  htmlChanges += rows.changed;

  // Bilder nach Position — ohne die Kachel-Bilder, die gehören zu page.bands.
  const images = [];
  for (const i of page.images ?? []) images.push({ ...i, src: (await imagePath(i.src)) ?? i.src });
  const { masked, restore } = maskRegion(html);
  const img = setImages(masked, images);
  if (img.skipped) notes.push(`${page.slug}: ${img.skipped} — Bilder übersprungen`);
  html = restore(img.html);
  imageChanges += img.changed;

  if (html !== before && !DRY) writeFileSync(file, html);
}

/* ---------- Header, Footer, Module: in JEDE Seite ---------- */
// Über die Dateien auf der Platte, nicht über die Seiten des Exports: sonst
// hinge es davon ab, dass der Export jede Seite mitbringt (ein Export nur mit
// „global“ hätte en.js geändert, aber keine Seite — i18n.test.js schlägt an).
const shared = sharedKeys(content.pages);
if (shared.length) {
  const pagesDir = join(ROOT, 'pages');
  const shells = [join(ROOT, 'index.html'), ...(existsSync(pagesDir) ? readdirSync(pagesDir) : [])
    .map((d) => join(pagesDir, d, 'index.html')).filter((f) => existsSync(f))];
  for (const file of shells) {
    const before = readFileSync(file, 'utf8');
    const r = applyKeysToHtml(before, shared, (key) => enByKey.get(key));
    htmlChanges += r.changed;
    if (r.html !== before && !DRY) writeFileSync(file, r.html);
  }
}

if (!DRY) for (const d of Object.values(dicts)) writeFileSync(d.file, d.lines.join('\n'));

// Stand für das CMS: genau das, was übernommen wurde. content.yml legt ihn erst
// nach Prüfung und Push in cms_publishes ab (scripts/record-publish.mjs).
if (!DRY && process.env.CMS_SNAPSHOT_FILE) {
  writeFileSync(process.env.CMS_SNAPSHOT_FILE, JSON.stringify(toSnapshot(content, (key) => enByKey.has(key))));
}

/* ---------- Bericht ---------- */
console.log(`Export: ${source}`);
console.log(`Seiten im Export: ${content.pages.length}`);
console.log(`Wörterbuch-Werte geändert: ${dictChanges}`);
console.log(`Texte in Shells geändert:  ${htmlChanges}`);
console.log(`Bildpfade geändert:        ${imageChanges}`);
console.log(`Seiten mit geänderten Kacheln: ${bandChanges} (Schlüssel neu: ${dictKeysAdded}, entfernt: ${dictKeysRemoved})`);
console.log(`Bilder aus dem CMS geladen: ${downloads}`);
if (notes.length > 0) {
  console.log(`\nHinweise (${notes.length}):`);
  for (const n of notes) console.log(`  - ${n}`);
  // Im GitHub-Lauf zusätzlich als Warnung: dann steht sie in der Zusammenfassung des Laufs,
  // nicht nur im Log — eine übersprungene Kachel ist kein Fehler, soll aber auffallen.
  if (process.env.GITHUB_ACTIONS) for (const n of notes) console.log(`::warning title=CMS-Übernahme::${n.replace(/\s+/g, ' ')}`);
}
if (DRY) console.log('\n--dry: nichts geschrieben.');
else console.log('\nJetzt prüfen: npm run lint && npm run test:run && npm run build');
