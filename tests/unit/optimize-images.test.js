/**
 * Feature: Bilder beim Veröffentlichen verkleinern (scripts/lib/optimize-images.mjs).
 */
import { describe, it, expect } from 'vitest';
import { imagePaths, rewriteImages, touchSitemap, sitemapImages, visibleImages, webpPath, MAX_WIDTH } from '../../scripts/lib/optimize-images.mjs';

const lookup = (map, sizes = {}) => {
  const f = (p) => map[p] ?? null;
  f.size = (p) => sizes[p] ?? null;
  return f;
};

describe('Feature: Bilder als WebP ausliefern', () => {
  const html = [
    '<div class="moon"><img class="moon-img" src="/Bilder/cms/start.png" alt="" decoding="async"></div>',
    '<img class="band-media" src="/Bilder/cms/a.jpg" alt="" loading="lazy">',
    '<div class="portrait" data-portrait-src="/Bilder/cms/p.JPEG" data-portrait-alt="X"></div>',
    '<img src="/Bilder/cms/schon.webp" alt=""><img src="/icon.png" alt="">',
  ].join('\n');

  it('findet png/jpg unter /Bilder/ (auch Portrait), nicht WebP und nichts außerhalb', () => {
    expect(imagePaths(html)).toEqual(['/Bilder/cms/start.png', '/Bilder/cms/a.jpg', '/Bilder/cms/p.JPEG']);
    expect(webpPath('/Bilder/cms/x.jpg.png')).toBe('/Bilder/cms/x.jpg.webp');
    expect(MAX_WIDTH).toBe(1920);
  });

  it('stellt auf WebP um, Startbild bekommt width/height; ohne Treffer bleibt das Original', () => {
    const r = rewriteImages(html, lookup(
      { '/Bilder/cms/start.png': { webp: '/Bilder/cms/start.webp', width: 1920, height: 1875 }, '/Bilder/cms/p.JPEG': { webp: '/Bilder/cms/p.webp' } },
      { '/Bilder/cms/start.webp': { width: 1920, height: 1875 } },
    ));
    expect(r.html).toContain('<img class="moon-img" src="/Bilder/cms/start.webp" alt="" decoding="async" width="1920" height="1875">');
    expect(r.html).toContain('data-portrait-src="/Bilder/cms/p.webp"');
    expect(r.html).toContain('src="/Bilder/cms/a.jpg"'); // WebP wäre nicht kleiner gewesen
    expect(r.html).toContain('<img src="/icon.png" alt="">');
  });

  it('zweimal anwenden ändert nichts; neue Maße ersetzen alte', () => {
    const map = { '/Bilder/cms/start.png': { webp: '/Bilder/cms/start.webp' } };
    const sizes = { '/Bilder/cms/start.webp': { width: 1920, height: 1875 } };
    const once = rewriteImages(html, lookup(map, sizes)).html;
    expect(rewriteImages(once, lookup(map, sizes)).html).toBe(once);
    const resized = rewriteImages(once, lookup(map, { '/Bilder/cms/start.webp': { width: 1600, height: 900 } })).html;
    expect(resized).toContain('decoding="async" width="1600" height="900">');
    expect(resized).not.toContain('1875');
  });
});

describe('Feature: Sitemap-Datum nachziehen', () => {
  it('nur geänderte Seiten bekommen das heutige Datum', () => {
    const xml = '<url><loc>https://rethink.space/</loc><lastmod>2026-09-15</lastmod></url>\n<url><loc>https://rethink.space/pages/people/</loc><lastmod>2026-09-15</lastmod></url>';
    const out = touchSitemap(xml, (loc) => loc.endsWith('/people/'), '2026-10-05');
    expect(out).toContain('<loc>https://rethink.space/</loc><lastmod>2026-09-15</lastmod>');
    expect(out).toContain('<loc>https://rethink.space/pages/people/</loc><lastmod>2026-10-05</lastmod>');
  });
});

describe('Feature: Bilder-Sitemap für die Google-Bildersuche', () => {
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url><loc>https://rethink.space/</loc><lastmod>2026-10-05</lastmod></url>',
    '  <url><loc>https://rethink.space/pages/privacy/</loc><lastmod>2026-09-15</lastmod></url>',
    '</urlset>',
  ].join('\n');
  const imgs = { 'https://rethink.space/': ['https://rethink.space/Bilder/cms/a.webp', 'https://rethink.space/Bilder/cms/b.webp'], 'https://rethink.space/pages/privacy/': [] };

  it('je Seite die sichtbaren Bilder, Namensraum einmal, lastmod bleibt; zweimal anwenden ändert nichts', () => {
    const out = sitemapImages(xml, (loc) => imgs[loc] ?? null);
    expect(out).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    expect(out).toContain('<url><loc>https://rethink.space/</loc><lastmod>2026-10-05</lastmod><image:image><image:loc>https://rethink.space/Bilder/cms/a.webp</image:loc></image:image><image:image><image:loc>https://rethink.space/Bilder/cms/b.webp</image:loc></image:image></url>');
    expect(out).toContain('<url><loc>https://rethink.space/pages/privacy/</loc><lastmod>2026-09-15</lastmod></url>');
    expect(sitemapImages(out, (loc) => imgs[loc] ?? null)).toBe(out);
    // Datum nachziehen lässt die Bildeinträge stehen
    expect(touchSitemap(out, () => true, '2026-10-06')).toContain('<lastmod>2026-10-06</lastmod><image:image>');
  });

  it('nur sichtbare Bilder, ohne Doppelte (ausgeblendete und Portrait mit hidden nicht)', () => {
    const html = '<img class="moon-img" src="/Bilder/cms/a.webp" alt="x"><img src="/Bilder/cms/h.webp" alt="" hidden>'
      + '<div class="portrait" data-portrait-src="/Bilder/cms/p.webp" hidden></div><img src="/Bilder/cms/a.webp" alt=""><img src="/icon.png" alt="">';
    expect(visibleImages(html)).toEqual(['/Bilder/cms/a.webp']);
  });
});

