/**
 * Reine Umformungen für „CMS-Export zurück in die Website“ (scripts/apply-content.mjs).
 * Ohne Dateizugriff, damit tests/unit/apply-content.test.js sie prüfen kann.
 */

const rx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const escapeAttr = (s) => escapeHtml(s).replace(/"/g, '&quot;');

/**
 * Einen Wert in de.js/en.js ersetzen, ohne die Formatierung der Datei zu stören.
 * Gibt zurück, ob sich etwas geändert hat.
 */
export function setDictValue(lines, key, value) {
  const i = lines.findIndex((l) => l.trimStart().startsWith(`'${key}':`));
  if (i < 0) return false;
  const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const next = lines[i].replace(/:(\s*)'(?:[^'\\]|\\.)*'/, `:$1'${escaped}'`);
  if (next === lines[i]) return false;
  lines[i] = next;
  return true;
}

export function hasDictKey(lines, key) {
  return lines.some((l) => l.trimStart().startsWith(`'${key}':`));
}

/**
 * Text zwischen <tag …data-i18n="key"…> und </tag> setzen — an JEDER Fundstelle.
 * Ein Schlüssel steht oft mehrfach in einer Seite (z. B. „Learn more“).
 */
export function setElementText(html, key, value) {
  const re = new RegExp(`(<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*\\sdata-i18n="${rx(key)}"[^>]*>)([\\s\\S]*?)(</\\2>)`, 'g');
  const next = escapeHtml(value);
  let changed = false;
  const out = html.replace(re, (all, open, _tag, text, close) => {
    if (text === next) return all;
    changed = true;
    return open + next + close;
  });
  return { html: out, changed };
}

/**
 * Attribut an jedem Element mit data-i18n-<kind>="key" setzen.
 * Titel und Beschreibung stehen je Seite zweimal (name=… und og:…).
 */
export function setElementAttr(html, key, value, kind, attr) {
  const re = new RegExp(`<[a-zA-Z][a-zA-Z0-9]*\\b[^>]*\\sdata-i18n-${rx(kind)}="${rx(key)}"[^>]*>`, 'g');
  const attrRe = new RegExp(`\\s${rx(attr)}="[^"]*"`);
  let changed = false;
  const out = html.replace(re, (tag) => {
    if (!attrRe.test(tag)) return tag;
    const nextTag = tag.replace(attrRe, ` ${attr}="${escapeAttr(value)}"`);
    if (nextTag !== tag) changed = true;
    return nextTag;
  });
  return { html: out, changed };
}

/** Alle Bildpfade einer Seite in Dokumentreihenfolge. */
export function listImages(html) {
  return [...html.matchAll(/(?:\ssrc="|\sdata-portrait-src=")(\/Bilder\/[^"]+)"/g)].map((m) => m[1]);
}

/**
 * Bildpfade in Dokumentreihenfolge ersetzen. Bei Galerie-Bildern wandert das
 * href mit dem src (sonst zeigt die Lightbox das alte Bild, CLAUDE.md Regel 10).
 * Passt die Anzahl nicht, bleibt die Seite unangetastet — lieber nichts tun als
 * Bilder verschieben.
 */
export function setImages(html, images) {
  const current = listImages(html);
  if (current.length !== images.length) {
    return { html, changed: 0, skipped: `${current.length} Bilder in der Seite, ${images.length} im Export` };
  }
  let out = html;
  let changed = 0;
  images.forEach((img, i) => {
    const from = current[i];
    const to = img?.src;
    if (!to || to === from || !to.startsWith('/Bilder/')) return;
    const before = out;
    out = out.replace(new RegExp(`href="${rx(from)}"([^>]*data-lightbox)`), `href="${to}"$1`);
    out = out.replace(new RegExp(`(\\ssrc="|\\sdata-portrait-src=")${rx(from)}"`), `$1${to}"`);
    if (out !== before) changed++;
  });
  return { html: out, changed, skipped: null };
}

/** Alle Texte und Attribute eines Schlüssels in einer Seite setzen. */
export function applyKeyToHtml(html, key, value) {
  let out = html;
  let changed = 0;
  for (const step of [
    () => setElementText(out, key, value),
    () => setElementAttr(out, key, value, 'content', 'content'),
    () => setElementAttr(out, key, value, 'aria-label', 'aria-label'),
    () => setElementAttr(out, key, value, 'placeholder', 'placeholder'),
  ]) {
    const r = step();
    out = r.html;
    if (r.changed) changed++;
  }
  return { html: out, changed };
}
