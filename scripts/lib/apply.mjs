/**
 * Reine Umformungen für „CMS-Export zurück in die Website“ (scripts/apply-content.mjs).
 * Ohne Dateizugriff, damit tests/unit/apply-content.test.js sie prüfen kann.
 */

import { isRichKey, renderRichHtml } from '../../src/site/i18n/rich-text.js';

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
  // Zeilenumbrüche (Absätze in Kachel-Texten) als \n — ein echter Umbruch
  // zerbräche die Zeile im Wörterbuch und damit den Build.
  const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n');
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
 *
 * Kacheltexte (*.panel.*.text) sind formatiert (rich-text.js): sie werden als
 * HTML aus p/ul/li/strong/em/a/br geschrieben, das Element ist ein <div>
 * (ein <p> darf keine Absätze und Listen enthalten). Die Suche endet am ersten
 * passenden Schlusstag — deshalb erzeugt rich-text.js nie ein <div>
 * (tests/unit/rich-text.test.js hält das fest).
 */
export function setElementText(html, key, value) {
  const re = new RegExp(`(<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*\\sdata-i18n="${rx(key)}"[^>]*>)([\\s\\S]*?)(</\\2>)`, 'g');
  const rich = isRichKey(key);
  const next = rich ? renderRichHtml(value) : escapeHtml(value);
  let changed = false;
  const out = html.replace(re, (all, open, tag, text, close) => {
    const asDiv = rich && tag.toLowerCase() === 'p';
    if (text === next && !asDiv) return all;
    changed = true;
    return asDiv ? `${open.replace(/^<p\b/i, '<div')}${next}</div>` : open + next + close;
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

/**
 * Geteilte Schlüssel der Pseudo-Seite „global“ (Header, Footer, Module). Sie
 * stehen im HTML JEDER Seite — ohne sie bekäme en.js einen neuen Footer-Text,
 * die Seiten aber nicht, und i18n.test.js (HTML-Text = EN-Wörterbuch) hielte
 * das Veröffentlichen an.
 */
export function sharedKeys(pages) {
  return (pages ?? []).find((p) => p.slug === 'global')?.keys ?? [];
}

/**
 * Mehrere Schlüssel in einer Seite setzen; `enOf(key)` liefert den Text oder
 * undefined (dann bleibt die Stelle, wie sie ist). Schlüssel, die nur das
 * JavaScript nutzt (chat.*, gate.*), stehen nicht im HTML — kein Treffer, kein Fehler.
 */
export function applyKeysToHtml(html, keys, enOf) {
  let out = html;
  let changed = 0;
  for (const k of keys) {
    const en = enOf(k.key);
    if (en === undefined) continue;
    const r = applyKeyToHtml(out, k.key, en);
    out = r.html;
    changed += r.changed;
  }
  return { html: out, changed };
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
