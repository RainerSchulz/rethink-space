/**
 * Bilder der Seiten verkleinern und die Sitemap nachziehen. Aufruf:
 *   npm run images:optimize
 * Läuft beim Veröffentlichen nach content:apply (content.yml) und lässt sich jederzeit
 * wiederholen: vorhandene WebP-Dateien werden nicht neu kodiert.
 *
 * Je Bild unter /Bilder/ (png/jpg): WebP daneben, höchstens 1920 px breit, Qualität 80.
 * Wird die WebP-Fassung nicht kleiner, bleibt die Seite beim Original.
 * Logik am HTML: scripts/lib/optimize-images.mjs.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import sharp from 'sharp';
import { MAX_WIDTH, QUALITY, imagePaths, rewriteImages, touchSitemap, webpPath } from './lib/optimize-images.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const pagesDir = join(ROOT, 'pages');
const files = [join(ROOT, 'index.html'), ...readdirSync(pagesDir).map((d) => join(pagesDir, d, 'index.html')).filter(existsSync)];

const kb = (n) => `${Math.round(n / 1024)} KB`;
const known = new Map(); // Originalpfad → { webp, width, height } | null
const sizes = new Map(); // ausgelieferter Pfad → { width, height }
let before = 0;
let after = 0;
let encoded = 0;

async function prepare(path) {
  if (known.has(path)) return;
  const orig = join(PUBLIC, path);
  if (!existsSync(orig)) { known.set(path, null); return; }
  const target = webpPath(path);
  const out = join(PUBLIC, target);
  if (!existsSync(out) || statSync(out).mtimeMs < statSync(orig).mtimeMs) {
    await sharp(orig).rotate().resize({ width: MAX_WIDTH, withoutEnlargement: true }).webp({ quality: QUALITY }).toFile(out);
    encoded++;
  }
  const o = statSync(orig).size;
  const w = statSync(out).size;
  before += o;
  if (w >= o) { known.set(path, null); after += o; return; } // WebP bringt nichts: Original behalten
  after += w;
  const meta = await sharp(out).metadata();
  known.set(path, { webp: target, width: meta.width, height: meta.height });
  sizes.set(target, { width: meta.width, height: meta.height });
}

/** Größe einer schon ausgelieferten Datei (für width/height am Startbild). */
async function sizeOf(path) {
  if (sizes.has(path) || !path.startsWith('/Bilder/')) return;
  const file = join(PUBLIC, path);
  if (!existsSync(file)) return;
  const meta = await sharp(file).metadata();
  sizes.set(path, { width: meta.autoOrient?.width ?? meta.width, height: meta.autoOrient?.height ?? meta.height });
}

const changedPages = new Set();
for (const file of files) {
  const html = readFileSync(file, 'utf8');
  for (const p of imagePaths(html)) await prepare(p);
  for (const m of html.matchAll(/<img class="moon-img[^"]*"[^>]*\ssrc="([^"]+)"/g)) await sizeOf(m[1]);
  const lookup = (p) => known.get(p) ?? null;
  lookup.size = (p) => sizes.get(p) ?? null;
  const r = rewriteImages(html, lookup);
  if (r.html !== html) {
    writeFileSync(file, r.html);
    changedPages.add(file);
  }
}

// Sitemap: Seiten, die sich gegenüber dem letzten Commit geändert haben, bekommen das heutige Datum.
const sitemap = join(PUBLIC, 'sitemap.xml');
if (existsSync(sitemap)) {
  const fileOf = (loc) => {
    const path = new URL(loc).pathname;
    return path === '/' ? join(ROOT, 'index.html') : join(ROOT, path, 'index.html');
  };
  const isChanged = (loc) => {
    const file = fileOf(loc);
    if (!existsSync(file)) return false;
    try {
      execFileSync('git', ['diff', '--quiet', 'HEAD', '--', file], { cwd: ROOT });
      return false;
    } catch { return true; } // Unterschied (oder kein git) → als geändert werten
  };
  const xml = readFileSync(sitemap, 'utf8');
  const next = touchSitemap(xml, isChanged, new Date().toISOString().slice(0, 10));
  if (next !== xml) writeFileSync(sitemap, next);
}

console.log(`Bilder: ${known.size} geprüft, ${encoded} neu kodiert, ${changedPages.size} Seiten angepasst`);
if (before) console.log(`Ausgeliefert statt ${kb(before)} jetzt ${kb(after)} (${Math.round(100 - (100 * after) / before)} % kleiner)`);
