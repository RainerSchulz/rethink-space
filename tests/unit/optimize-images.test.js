/**
 * Feature: Bilder beim Veröffentlichen verkleinern (scripts/lib/optimize-images.mjs).
 */
import { describe, it, expect } from 'vitest';
import { imagePaths, rewriteImages, touchSitemap, webpPath, MAX_WIDTH } from '../../scripts/lib/optimize-images.mjs';

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
