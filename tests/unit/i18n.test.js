/**
 * Feature: i18n-Parität und Schlüssel-Abdeckung
 *
 * Sichert:
 *  - DE und EN haben exakt dieselben Schlüssel.
 *  - Jeder im HTML oder in src/ verwendete Schlüssel ist definiert.
 *  - Jeder definierte Schlüssel wird auch verwendet (keine Leichen).
 *  - Der deutsche Fallback-Text im HTML entspricht dem DE-Wörterbuch.
 */
import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { DE } from '../../src/site/i18n/de.js';
import { EN } from '../../src/site/i18n/en.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const deKeys = Object.keys(DE);
const enKeys = Object.keys(EN);

// Die Startseite liegt als index.html in der Wurzel, alle anderen unter pages/.
const htmlFiles = ['index.html', ...readdirSync(join(ROOT, 'pages')).map((d) => `pages/${d}/index.html`)];
const htmlDocs = htmlFiles.map((f) => ({
  file: f,
  html: readFileSync(join(ROOT, f), 'utf8'),
}));

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : d.name.endsWith('.js') ? [join(dir, d.name)] : [],
  );
}
const srcFiles = walk(join(ROOT, 'src'));

const usedInHtml = new Set();
const I18N_ATTR = /data-i18n(?:-content|-aria-label|-placeholder)?="([^"]+)"/g;
for (const { html } of htmlDocs) {
  for (const m of html.matchAll(I18N_ATTR)) usedInHtml.add(m[1]);
}
const usedInSrc = new Set();
for (const f of srcFiles) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bt\('([^']+)'\)/g)) usedInSrc.add(m[1]);
}

describe('Feature: i18n-Parität (de.js / en.js)', () => {
  it('DE- und EN-Schlüssel vorhanden', () => {
    expect(deKeys.length).toBeGreaterThan(100);
    expect(enKeys.length).toBeGreaterThan(100);
  });

  it('jeder DE-Schlüssel existiert in EN', () => {
    const missing = deKeys.filter((k) => !(k in EN));
    expect(missing, `Fehlt in EN: ${missing.join(', ')}`).toHaveLength(0);
  });

  it('jeder EN-Schlüssel existiert in DE', () => {
    const missing = enKeys.filter((k) => !(k in DE));
    expect(missing, `Fehlt in DE: ${missing.join(', ')}`).toHaveLength(0);
  });

  it('alle Schlüssel folgen dem Format "namespace.bereich.detail"', () => {
    const invalid = deKeys.filter((k) => !/^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/.test(k));
    expect(invalid, `Ungültige Schlüssel: ${invalid.join(', ')}`).toHaveLength(0);
  });

  it('kein Wert ist leer', () => {
    const empty = [...deKeys.filter((k) => !DE[k].trim()), ...enKeys.filter((k) => !EN[k].trim())];
    expect(empty).toHaveLength(0);
  });

  it('keine doppelten Schlüssel im Quelltext (spätere Definition würde frühere überschreiben)', () => {
    for (const file of ['de.js', 'en.js']) {
      const src = readFileSync(join(ROOT, 'src/site/i18n', file), 'utf8');
      const seen = new Map();
      for (const m of src.matchAll(/^\s+'([a-z][^']+)'\s*:/gm)) seen.set(m[1], (seen.get(m[1]) || 0) + 1);
      const dupes = [...seen].filter(([, n]) => n > 1).map(([k]) => k);
      expect(dupes, `${file}: doppelt: ${dupes.join(', ')}`).toHaveLength(0);
    }
  });
});

describe('Feature: Schlüssel-Abdeckung (HTML + src)', () => {
  it('HTML-Seiten gefunden', () => {
    expect(htmlFiles.length).toBeGreaterThanOrEqual(12);
  });

  it('jeder data-i18n*-Schlüssel im HTML ist in DE und EN definiert', () => {
    const missing = [...usedInHtml].filter((k) => !(k in DE) || !(k in EN));
    expect(missing, `Undefiniert: ${missing.join(', ')}`).toHaveLength(0);
  });

  it('jeder t(\'…\')-Schlüssel in src/ ist in DE und EN definiert', () => {
    const missing = [...usedInSrc].filter((k) => !(k in DE) || !(k in EN));
    expect(missing, `Undefiniert: ${missing.join(', ')}`).toHaveLength(0);
  });

  it('jeder definierte Schlüssel wird im HTML oder in src/ verwendet', () => {
    const unused = deKeys.filter((k) => !usedInHtml.has(k) && !usedInSrc.has(k));
    expect(unused, `Ungenutzt: ${unused.join(', ')}`).toHaveLength(0);
  });

  it('englischer Fallback-Text im HTML entspricht dem EN-Wörterbuch (Englisch ist Standard)', () => {
    const mismatches = [];
    for (const { file, html } of htmlDocs) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      doc.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        const text = el.textContent.trim().replace(/\s+/g, ' ');
        if (text !== EN[key]) mismatches.push(`${file}: ${key} → "${text}"`);
      });
      doc.querySelectorAll('[data-i18n-content]').forEach((el) => {
        const key = el.getAttribute('data-i18n-content');
        if (el.getAttribute('content') !== EN[key]) mismatches.push(`${file}: ${key} (content)`);
      });
    }
    expect(mismatches, mismatches.join('\n')).toHaveLength(0);
  });
});
