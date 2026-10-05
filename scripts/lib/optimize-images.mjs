/**
 * Bilder für die Auslieferung verkleinern — reine Umformungen am HTML, ohne Dateizugriff
 * (getestet in tests/unit/optimize-images.test.js; das Kodieren macht scripts/optimize-images.mjs).
 *
 * Aus dem CMS kommen Bilder so, wie sie hochgeladen wurden (PNG/JPG, oft 3000 px und 3 MB).
 * Für jedes Bild unter /Bilder/ entsteht daneben eine WebP-Fassung (höchstens MAX_WIDTH breit);
 * die Seite zeigt auf sie, das Original bleibt als Rückfall liegen. Das Startbild bekommt
 * dazu width/height (der Platz ist reserviert, die Seite springt beim Laden nicht).
 */

export const MAX_WIDTH = 1920;
export const QUALITY = 80;

/** Bildpfade, die verkleinert werden: /Bilder/…png|jpg|jpeg in src="…" oder data-portrait-src="…". */
const ATTR_RE = /(\s(?:src|data-portrait-src)=")(\/Bilder\/[^"]+?\.(?:png|jpe?g))"/gi;

/** /Bilder/cms/foto.jpg → /Bilder/cms/foto.webp */
export const webpPath = (path) => path.replace(/\.(png|jpe?g)$/i, '.webp');

/** Alle Originalpfade einer Seite (ohne Doppelte). */
export function imagePaths(html) {
  return [...new Set([...String(html).matchAll(ATTR_RE)].map((m) => m[2]))];
}

/**
 * Pfade auf die WebP-Fassung umstellen.
 * @param {string} html
 * @param {(path:string) => ({ webp: string, width: number, height: number } | null)} lookup
 *   null = Original behalten (WebP nicht kleiner oder nicht erzeugbar)
 * @returns {{ html: string, changed: number }}
 */
export function rewriteImages(html, lookup) {
  let changed = 0;
  let out = String(html).replace(ATTR_RE, (all, attr, path) => {
    const hit = lookup(path);
    if (!hit) return all;
    changed++;
    return `${attr}${hit.webp}"`;
  });
  // Startbild: Breite und Höhe der ausgelieferten Datei (CSS: width 100 %, height auto)
  out = out.replace(/<img class="moon-img[^"]*"[^>]*>/g, (tag) => {
    const src = /\ssrc="([^"]+)"/.exec(tag)?.[1];
    const size = src && lookup.size?.(src);
    if (!size) return tag;
    let next = tag.replace(/\s(?:width|height)="\d+"/g, '');
    next = next.replace(/\s*>$/, ` width="${size.width}" height="${size.height}">`);
    if (next !== tag) changed++;
    return next;
  });
  return { html: out, changed };
}

/**
 * Sitemap: lastmod der geänderten Seiten auf heute.
 * @param {string} xml
 * @param {(loc:string) => boolean} isChanged
 * @param {string} today  JJJJ-MM-TT
 */
export function touchSitemap(xml, isChanged, today) {
  return String(xml).replace(/<url><loc>([^<]+)<\/loc><lastmod>[^<]*<\/lastmod>(.*?)<\/url>/g,
    (all, loc, rest) => (isChanged(loc) ? `<url><loc>${loc}</loc><lastmod>${today}</lastmod>${rest}</url>` : all));
}

/**
 * Sichtbare Bilder einer Seite (für die Bilder-Sitemap): src/data-portrait-src unter /Bilder/,
 * ohne ausgeblendete (hidden) — in Dokumentreihenfolge, ohne Doppelte.
 */
export function visibleImages(html) {
  const out = [];
  for (const tag of String(html).match(/<(?:img|div)\b[^>]*\s(?:src|data-portrait-src)="\/Bilder\/[^"]+"[^>]*>/g) ?? []) {
    if (/\shidden(?:[\s=>])/.test(tag)) continue;
    const path = /\s(?:src|data-portrait-src)="(\/Bilder\/[^"]+)"/.exec(tag)[1];
    if (!out.includes(path)) out.push(path);
  }
  return out;
}

/**
 * Bilder-Sitemap (Google): je Seite <image:image><image:loc> für jedes sichtbare Bild.
 * Bestehende Bildeinträge werden ersetzt, lastmod bleibt; der Namensraum kommt einmal an urlset.
 * @param {string} xml
 * @param {(loc:string) => string[]|null} imagesOf  absolute Bildadressen je Seite (null = unverändert lassen)
 */
export function sitemapImages(xml, imagesOf) {
  let out = String(xml);
  if (!out.includes('xmlns:image=')) {
    out = out.replace('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">');
  }
  return out.replace(/<url><loc>([^<]+)<\/loc>(<lastmod>[^<]*<\/lastmod>)?(.*?)<\/url>/g, (all, loc, lastmod = '') => {
    const imgs = imagesOf(loc);
    if (!imgs) return all;
    const entries = imgs.map((u) => `<image:image><image:loc>${u.replace(/&/g, '&amp;')}</image:loc></image:image>`).join('');
    return `<url><loc>${loc}</loc>${lastmod}${entries}</url>`;
  });
}
