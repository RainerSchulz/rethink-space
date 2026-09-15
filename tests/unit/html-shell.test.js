/**
 * Feature: HTML-Shells halten den Coding Guide ein
 *
 * Regel #1: Eine HTML-Datei enthält nur Markup — kein <style>, kein
 * style="…", kein Inline-Script außer dem Vite-Entry (JSON-LD ist Daten).
 * Regel #2: Nur index.html (Weiterleitung) im Root, alle Seiten unter
 * pages/<name>/index.html. Header/Footer identisch, Links und Bilder
 * existieren, SEO-Kopfdaten vollständig, keine Drittanbieter.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { PAGES } from '../../vite.pages.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SITE = 'https://re-think-space.de';
const EXPECTED_PAGES = [
  'landing', 'vision', 'design', 'space', 'deployment', 'dual-use',
  'ip', 'news', 'autor', 'kontakt', 'impressum', 'datenschutz', '404',
];

const pageDirs = readdirSync(join(ROOT, 'pages')).filter((d) => statSync(join(ROOT, 'pages', d)).isDirectory());
const pages = pageDirs.map((slug) => ({
  slug,
  file: `pages/${slug}/index.html`,
  html: readFileSync(join(ROOT, 'pages', slug, 'index.html'), 'utf8'),
}));

const between = (html, tag) => {
  const m = html.match(new RegExp(`<${tag}[\\s>][\\s\\S]*?</${tag}>`));
  return m ? m[0] : null;
};

describe('Feature: Seitenbestand (Muster FORGE: pages/<name>/index.html)', () => {
  it('im Root liegt nur index.html', () => {
    const rootHtml = readdirSync(ROOT).filter((f) => f.endsWith('.html'));
    expect(rootHtml).toEqual(['index.html']);
  });

  it('root index.html leitet auf /pages/landing/ weiter', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    expect(html).toMatch(/http-equiv="refresh" content="0; url=\/pages\/landing\/"/);
    expect(html).toMatch(/<meta name="robots" content="noindex">/);
  });

  it('genau die erwarteten Seiten liegen unter pages/', () => {
    expect([...pageDirs].sort()).toEqual([...EXPECTED_PAGES].sort());
  });

  it('jede Seite besteht nur aus index.html (kein css/, kein js/)', () => {
    for (const slug of pageDirs) expect(readdirSync(join(ROOT, 'pages', slug)), slug).toEqual(['index.html']);
  });

  it('vite.pages.js kennt jede Seite und den Root-Redirect', () => {
    const inputs = Object.values(PAGES);
    expect(inputs).toContain('index.html');
    for (const slug of pageDirs) expect(inputs, slug).toContain(`pages/${slug}/index.html`);
    for (const p of inputs) expect(existsSync(join(ROOT, p)), p).toBe(true);
  });
});

describe.each(pages)('Feature: Shell-Regeln für $file', ({ slug, file, html }) => {
  it('enthält kein <style> und keine style-Attribute', () => {
    expect(html).not.toMatch(/<style[\s>]/i);
    expect(html).not.toMatch(/\sstyle="/i);
  });

  it('einziges Script ist der Vite-Entry; JSON-LD ist als Daten erlaubt', () => {
    const scripts = html.match(/<script[\s\S]*?<\/script>/gi) || [];
    const entries = scripts.filter((s) => s === '<script type="module" src="/src/site/main.js"></script>');
    const others = scripts.filter((s) => !entries.includes(s));
    expect(entries).toHaveLength(1);
    for (const s of others) {
      expect(s).toMatch(/^<script type="application\/ld\+json">/);
      expect(() => JSON.parse(s.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''))).not.toThrow();
    }
    expect(html).not.toMatch(/\son[a-z]+="/i);
  });

  it('lädt keine Schriften oder Skripte von Drittanbietern', () => {
    expect(html).not.toMatch(/fonts\.googleapis|fonts\.gstatic|cdn\./i);
  });

  it('verlinkt das Stylesheet im <head> (kein Aufblitzen ohne CSS)', () => {
    const headHtml = between(html, 'head');
    expect(headHtml).toContain('<link rel="stylesheet" href="/src/site/site.css">');
    expect(headHtml.indexOf('rel="stylesheet"')).toBeLessThan(headHtml.indexOf('type="module"'));
  });

  it('hat vollständige, übersetzbare Kopfdaten (Titel, Description, Canonical, Open Graph)', () => {
    expect(html).toMatch(/<html lang="en">/);
    expect(html).toContain('<meta property="og:locale" content="en_US">');
    expect(html).toMatch(/<title data-i18n="[a-z.-]+">/);
    expect(html).toMatch(/<meta name="description" data-i18n-content="[a-z.-]+" content="[^"]+">/);
    expect(html).toContain(`<link rel="canonical" href="${SITE}/pages/${slug}/">`);
    expect(html).toContain(`<meta property="og:url" content="${SITE}/pages/${slug}/">`);
    expect(html).toMatch(/<meta property="og:title" data-i18n-content="[a-z.-]+" content="[^"]+">/);
    expect(html).toMatch(/<meta property="og:image" content="[^"]+">/);
    expect(html).toMatch(/<meta http-equiv="Content-Security-Policy"/);
    expect(html).toMatch(/<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg">/);
  });

  it('404 ist noindex, alle anderen Seiten sind indexierbar', () => {
    const noindex = /<meta name="robots" content="noindex">/.test(html);
    expect(noindex).toBe(slug === '404');
  });

  it('enthält keine Reste der alten Doppelsprach-Spans', () => {
    expect(html).not.toMatch(/class="(de|en)"/);
  });

  it('bleibt unter 300 Zeilen', () => {
    expect(html.split('\n').length).toBeLessThan(300);
  });

  it('alle internen Links zeigen auf vorhandene Seiten', () => {
    const links = [...html.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]).filter((h) => !h.startsWith('//'));
    const missing = links.filter((h) => {
      const m = h.match(/^\/pages\/([a-z0-9-]+)\/$/);
      if (m) return !existsSync(join(ROOT, 'pages', m[1], 'index.html'));
      return !existsSync(join(ROOT, 'public', h)) && !existsSync(join(ROOT, h));
    });
    expect(missing, `Fehlende Ziele in ${file}: ${missing.join(', ')}`).toHaveLength(0);
  });

  it('alle Bilder liegen in public/ (Portrait ausgenommen: lädt portrait.js mit Fallback)', () => {
    const missing = [...html.matchAll(/\ssrc="\/(Bilder\/[^"]+)"/g)]
      .map((m) => m[1])
      .filter((p) => !existsSync(join(ROOT, 'public', p)));
    expect(missing, `Fehlende Bilder in ${file}: ${missing.join(', ')}`).toHaveLength(0);
  });
});

describe('Feature: Header und Footer sind auf allen Seiten identisch', () => {
  const ref = pages.find((p) => p.slug === 'landing');

  it('Header identisch', () => {
    const refHeader = between(ref.html, 'header');
    expect(refHeader).not.toBeNull();
    for (const p of pages) expect(between(p.html, 'header'), p.file).toBe(refHeader);
  });

  it('Footer identisch', () => {
    const refFooter = between(ref.html, 'footer');
    expect(refFooter).not.toBeNull();
    for (const p of pages) expect(between(p.html, 'footer'), p.file).toBe(refFooter);
  });

  it('Logo ist immer ein Home-Link', () => {
    for (const p of pages) expect(p.html, p.file).toMatch(/<a class="logo" href="\/pages\/landing\/"/);
  });
});

describe('Feature: Suchmaschinen-Dateien in public/', () => {
  it('sitemap.xml listet jede indexierbare Seite genau einmal', () => {
    const xml = readFileSync(join(ROOT, 'public/sitemap.xml'), 'utf8');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const expected = EXPECTED_PAGES.filter((s) => s !== '404').map((s) => `${SITE}/pages/${s}/`);
    expect([...locs].sort()).toEqual([...expected].sort());
  });

  it('robots.txt verweist auf die Sitemap und sperrt die 404-Seite', () => {
    const txt = readFileSync(join(ROOT, 'public/robots.txt'), 'utf8');
    expect(txt).toContain(`Sitemap: ${SITE}/sitemap.xml`);
    expect(txt).toContain('Disallow: /pages/404/');
  });

  it('Favicon, Manifest und OG-Bild existieren', () => {
    for (const f of ['favicon.svg', 'site.webmanifest', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'og-image.jpg']) {
      expect(existsSync(join(ROOT, 'public', f)), f).toBe(true);
    }
  });
});
