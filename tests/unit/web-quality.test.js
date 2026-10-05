/**
 * Feature: Webseiten-optimiert (CLAUDE.md Regel 14) — Ladegewicht und SEO-Grundlagen jeder Seite.
 * Läuft lokal, in ci.yml und in content.yml vor jedem Commit aus dem CMS: ein zu großes Bild oder
 * eine Seite ohne Beschreibung geht so gar nicht erst online.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = join(import.meta.dirname, '../..');
const SITE = 'https://rethink.space';
/** Höchstwerte je ausgeliefertem Bild (nach `npm run images:optimize`). */
export const MAX_IMAGE_KB = 500;
export const MAX_IMAGE_WIDTH = 1920;

const pages = [['/', join(ROOT, 'index.html')], ...readdirSync(join(ROOT, 'pages'))
  .map((d) => [`/pages/${d}/`, join(ROOT, 'pages', d, 'index.html')]).filter(([, f]) => existsSync(f))];
const indexable = pages.filter(([url]) => url !== '/pages/404/');
const attr = (html, re) => re.exec(html)?.[1] ?? null;
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

describe('Feature: SEO-Grundlagen je Seite', () => {
  for (const [url, file] of indexable) {
    const html = readFileSync(file, 'utf8');
    it(`${url}: Titel, Beschreibung, Canonical, Vorschau-Daten, Sprache, genau ein h1`, () => {
      const title = decode(attr(html, /<title[^>]*>([^<]*)<\/title>/) ?? '');
      const desc = decode(attr(html, /<meta name="description"[^>]*\scontent="([^"]*)"/) ?? '');
      expect(title.length, `Titel „${title}“: 10–65 Zeichen`).toBeGreaterThanOrEqual(10);
      expect(title.length, `Titel „${title}“: 10–65 Zeichen`).toBeLessThanOrEqual(65);
      expect(desc.length, `Beschreibung „${desc}“: 50–160 Zeichen`).toBeGreaterThanOrEqual(50);
      expect(desc.length, `Beschreibung „${desc}“: 50–160 Zeichen`).toBeLessThanOrEqual(160);
      expect(html).toContain(`<link rel="canonical" href="${SITE}${url}">`);
      for (const p of ['og:title', 'og:description', 'og:image', 'og:url']) expect(html, p).toMatch(new RegExp(`property="${p}"`));
      expect(html).toMatch(/name="twitter:card"/);
      expect(html).toMatch(/<html lang="en"/);
      expect((html.match(/<h1\b/g) ?? []).length, 'genau ein h1').toBe(1);
    });
  }

  it('die Sitemap nennt jede indexierbare Seite, robots.txt verweist auf sie', () => {
    const sitemap = readFileSync(join(ROOT, 'public/sitemap.xml'), 'utf8');
    for (const [url] of indexable) expect(sitemap, url).toContain(`<loc>${SITE}${url}</loc>`);
    expect(readFileSync(join(ROOT, 'public/robots.txt'), 'utf8')).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });
});

describe('Feature: Ladegewicht der Bilder', () => {
  const used = new Set();
  for (const [, file] of pages) {
    const html = readFileSync(file, 'utf8');
    for (const m of html.matchAll(/\s(?:src|data-portrait-src)="(\/Bilder\/[^"]+)"/g)) used.add(m[1]);
    it(`${file.slice(ROOT.length)}: jedes <img> hat ein alt-Attribut`, () => {
      for (const tag of html.match(/<img\b[^>]*>/g) ?? []) expect(tag, 'alt fehlt').toMatch(/\salt="/);
    });
  }

  it(`jedes ausgelieferte Bild höchstens ${MAX_IMAGE_KB} KB und ${MAX_IMAGE_WIDTH} px breit (sonst: npm run images:optimize)`, async () => {
    for (const path of used) {
      const file = join(ROOT, 'public', path);
      const meta = await sharp(file).metadata();
      expect(meta.size ?? readFileSync(file).length, `${path} zu groß`).toBeLessThanOrEqual(MAX_IMAGE_KB * 1024);
      expect(meta.width, `${path} zu breit`).toBeLessThanOrEqual(MAX_IMAGE_WIDTH);
    }
  });

  it('das Startbild reserviert seinen Platz (width/height) — die Seite springt beim Laden nicht', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    expect(html).toMatch(/<img class="moon-img[^"]*"[^>]*\swidth="\d+" height="\d+">/);
  });
});
