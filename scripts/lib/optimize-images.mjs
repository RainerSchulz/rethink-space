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
  return String(xml).replace(/<url><loc>([^<]+)<\/loc><lastmod>[^<]*<\/lastmod><\/url>/g,
    (all, loc) => (isChanged(loc) ? `<url><loc>${loc}</loc><lastmod>${today}</lastmod></url>` : all));
}
