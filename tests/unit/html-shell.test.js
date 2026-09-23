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
const SITE = 'https://rethink.space';
const EXPECTED_PAGES = [
  'landing', 'lunar-habitato', 'design', 'space', 'deployment', 'dual-use',
  'ip', 'news', 'history', 'autor', 'kontakt', 'impressum', 'datenschutz', '404',
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
    expect(html).toContain("connect-src 'self' https://*.supabase.co;"); // Chat-Endpoint
    expect(html).toMatch(/<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg">/);
  });

  it('Barrierefreiheit: Skip-Link, fokussierbares main#main, benannte Navigationen', () => {
    const headHtml = between(html, 'header');
    expect(headHtml).toContain('<a class="skip-link" href="#main" data-i18n="common.skip">');
    expect(html).toContain('<main id="main" tabindex="-1">');
    expect(html).toMatch(/<nav class="nav" id="site-nav" aria-label="[^"]+" data-i18n-aria-label="nav\.main">/);
    expect(html).not.toMatch(/<hr class="rule">/); // Trennlinien sind Dekoration
  });

  it('jede Kachel ist ein Link mit Ziel und Pfeil-Label (wie FORGE: Kacheln immer klickbar)', () => {
    expect(html).not.toMatch(/<(div|section|article|li) class="(card|card-media|pillar)[" ]/);
    const tiles = [...html.matchAll(/<a class="(card|card-media|pillar)[" ][^>]*>([\s\S]*?)<\/a>/g)];
    for (const [tag, cls, inner] of tiles) {
      expect(tag, cls).toMatch(/href="\/pages\/[a-z0-9-]+\/"/);
      expect(inner, `${cls} ohne Pfeil-Label`).toMatch(/class="arrow-link"|class="body"/);
    }
    // Galerie-Bilder: Link auf die Bilddatei, Lightbox öffnet sie vergrößert
    for (const [figure] of html.matchAll(/<figure>[\s\S]*?<\/figure>/g)) {
      expect(figure).toMatch(/^<figure><a class="gallery-item" href="\/Bilder\/[^"]+" data-lightbox><img /);
    }
  });

  it('Lightbox zeigt genau das angezeigte Bild (href = src)', () => {
    for (const [, href, src] of html.matchAll(/<a class="gallery-item" href="([^"]+)" data-lightbox><img src="([^"]+)"/g)) {
      expect(src, `${file}: Lightbox öffnet ${href}, gezeigt wird ${src}`).toBe(href);
    }
  });

  it('keine Bilder mit eingebrannter Wortmarke (Regel 10: Wortmarke nur im Logo)', () => {
    const used = [...html.matchAll(/["'](\/Bilder\/[^"']+)["']/g)].map((m) => m[1]);
    const branded = used.filter((p) => /\/2026-09-Re-Think-|\/2026-09-Re-Dual-Use\./.test(p));
    expect(branded, `${file}: Originale mit Schriftzug – zugeschnittene Fassung (…-clean/…-wide) verwenden: ${branded.join(', ')}`).toHaveLength(0);
  });

  it('Bücher auf der Autorenseite verlinken auf Amazon.de (neuer Tab, rel=noopener)', () => {
    if (slug !== 'autor') return;
    const items = [...html.matchAll(/<li><a class="book" ([^>]*)>/g)];
    expect(items.length).toBeGreaterThanOrEqual(4);
    for (const [, attrs] of items) {
      expect(attrs).toMatch(/href="https:\/\/www\.amazon\.de\/dp\/[0-9X]{10}"/);
      expect(attrs).toContain('target="_blank"');
      expect(attrs).toContain('rel="noopener"');
    }
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

describe('Feature: Bänder klappen auf, statt zu verlinken', () => {
  // Seiten mit Bändern und der erwarteten Anzahl. Die Fläche ist hier
  // ausdrücklich kein Link — nur "Learn more" öffnet den Bereich darunter.
  const BAND_PAGES = [['lunar-habitato', 4], ['dual-use', 2], ['autor', 2]];

  for (const [slug, count] of BAND_PAGES) {
    describe(`/pages/${slug}/`, () => {
      const html = readFileSync(join(ROOT, `pages/${slug}/index.html`), 'utf8');

      it(`${count} Bänder, jedes mit Bild und Überschrift`, () => {
        expect([...html.matchAll(/<div class="band-group">/g)]).toHaveLength(count);
        expect([...html.matchAll(/<img class="band-media" src="\/Bilder\/[^"]+" alt="" loading="lazy">/g)]).toHaveLength(count);
        expect([...html.matchAll(/class="band-h"/g)]).toHaveLength(count);
      });

      it('das Band selbst ist kein Link — nur der Knopf ist bedienbar', () => {
        const groups = [...html.matchAll(/<div class="band-group">([\s\S]*?)<div class="band-panel"/g)].map((m) => m[1]);
        expect(groups).toHaveLength(count);
        for (const g of groups) expect(g, 'Band darf kein <a> enthalten').not.toMatch(/<a\b/);
      });

      it('jeder Knopf gehört über aria-controls zu einem vorhandenen Bereich', () => {
        const ids = [...html.matchAll(/<div class="band-panel" id="([^"]+)" hidden>/g)].map((m) => m[1]);
        const controls = [...html.matchAll(/<button class="arrow-link band-toggle" type="button" aria-expanded="false" aria-controls="([^"]+)"/g)].map((m) => m[1]);
        expect(controls).toHaveLength(count);
        expect([...controls].sort()).toEqual([...ids].sort());
      });

      it('alle Bereiche starten zugeklappt (hidden steht im Markup)', () => {
        expect([...html.matchAll(/<div class="band-panel" id="[^"]+" hidden>/g)]).toHaveLength(count);
      });

      it('genau eine <h1> auf der Seite (das erste Band)', () => {
        expect([...html.matchAll(/<h1\b/g)]).toHaveLength(1);
      });
    });
  }
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
