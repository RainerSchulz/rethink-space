/**
 * Reine Umformungen für „CMS-Export zurück in die Website“ (scripts/apply-content.mjs).
 * Ohne Dateizugriff, damit tests/unit/apply-content.test.js sie prüfen kann.
 */

import { isRichKey, renderRichHtml } from '../../src/site/i18n/rich-text.js';

const rx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const escapeAttr = (s) => escapeHtml(s).replace(/"/g, '&quot;');

/**
 * Text als Inhalt einer '…'-Zeichenkette in de.js/en.js — die EINE Stelle dafür
 * (setDictValue, bands.mjs insertDictKeys). Backslash und Apostroph maskiert;
 * jeder Zeilenumbruch (CRLF, LF, einzelnes CR) wird zu \n — ein rohes CR beendete
 * die Zeichenkette und bräche den Build. U+2028/2029 wären seit ES2019 erlaubt;
 * sie werden nur vorsorglich maskiert (ältere Werkzeuge lesen sie als Zeilenende).
 * tests/unit/special-chars.test.js prüft das mit einem Zeichenkatalog.
 */
export const escapeJsString = (s) => String(s)
  .replace(/\\/g, '\\\\')
  .replace(/'/g, "\\'")
  .replace(/\r\n?|\n/g, '\\n')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

/**
 * Einen Wert in de.js/en.js ersetzen, ohne die Formatierung der Datei zu stören.
 * Gibt zurück, ob sich etwas geändert hat.
 */
export function setDictValue(lines, key, value) {
  const i = lines.findIndex((l) => l.trimStart().startsWith(`'${key}':`));
  if (i < 0) return false;
  const escaped = escapeJsString(value);
  // Ersetzung als Funktion: in einem Ersetzungs-TEXT wären $1, $&, $$ … aus dem
  // Inhalt Platzhalter — „$1M“ im Kacheltext verfälschte so das Wörterbuch.
  const next = lines[i].replace(/:(\s*)'(?:[^'\\]|\\.)*'/, (_, space) => `:${space}'${escaped}'`);
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
    const nextTag = tag.replace(attrRe, () => ` ${attr}="${escapeAttr(value)}"`);
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
 * Ausschnitt und Zoom des Mondbilds der Startseite (<img class="moon-img">) → Klassen
 * (site.css .moon-img--top … --z250). Gleiche Regel im CMS (rethink-cms src/bands.js moonClass).
 */
const MOON_Y = { top: ' moon-img--top', bottom: ' moon-img--bottom' };
const MOON_X = { left: ' moon-img--left', right: ' moon-img--right' };
export const moonClass = (c = {}) => `moon-img${MOON_Y[c.focus] ?? ''}${MOON_X[c.focusX] ?? ''}`
  + `${Number.isInteger(c.zoom) && c.zoom > 100 && c.zoom <= 250 && c.zoom % 10 === 0 ? ` moon-img--z${c.zoom}` : ''}`
  // nur Desktop wirksam (site.css): Bild nach oben schieben, 5–80 % in Fünferschritten
  + `${Number.isInteger(c.shiftY) && c.shiftY >= 5 && c.shiftY <= 80 && c.shiftY % 5 === 0 ? ` moon-img--up${c.shiftY}` : ''}`;
const hasCrop = (img) => Boolean(img && (img.focus || img.focusX || img.zoom || img.shiftY));

/** Element (Tag) eines Bildes: <img src="/Bilder/…"> oder <div data-portrait-src="/Bilder/…">. */
const IMAGE_TAG = /<[a-zA-Z][^>]*?\s(?:src|data-portrait-src)="(\/Bilder\/[^"]+)"[^>]*>/g;
const HIDDEN_ATTR = /\shidden(?:="[^"]*")?(?=[\s/>])/;

/**
 * Bilder in Dokumentreihenfolge setzen — je Position Pfad und Sichtbarkeit.
 * Gearbeitet wird am Element der jeweiligen Position, nicht über den Pfad: steht
 * dasselbe Bild zweimal in der Seite (People: Portrait), träfe eine Suche nach
 * dem Pfad sonst die falsche Stelle.
 *
 * hidden: true heißt „im CMS entfernt“ — das Element bleibt (sonst verschöbe sich
 * die Reihenfolge, über die alle Bilder zugeordnet werden) und bekommt das
 * Attribut hidden; site.css blendet [hidden] aus. Ohne hidden wird es entfernt.
 *
 * Bei Galerie-Bildern wandert das href mit dem src (sonst zeigt die Lightbox das
 * alte Bild, CLAUDE.md Regel 10). Passt die Anzahl nicht, bleibt die Seite
 * unangetastet — lieber nichts tun als Bilder verschieben.
 */
export function setImages(html, images) {
  const tags = [...html.matchAll(IMAGE_TAG)];
  if (tags.length !== images.length) {
    return { html, changed: 0, skipped: `${tags.length} Bilder in der Seite, ${images.length} im Export` };
  }
  let out = html;
  let changed = 0;
  const moved = [];
  // Von hinten nach vorn: so bleiben die Fundstellen der vorderen Bilder gültig.
  for (let i = tags.length - 1; i >= 0; i--) {
    const { 0: tag, 1: from, index } = tags[i];
    const img = images[i];
    if (!img) continue;
    let next = tag;
    const to = img.src;
    if (to && to !== from && to.startsWith('/Bilder/')) {
      next = next.replace(`"${from}"`, () => `"${to}"`);
      moved.push([from, to]);
    }
    // Alt-Text aus dem CMS (vorher kam nur der Pfad an): <img alt>, beim Portrait data-portrait-alt
    if (typeof img.alt === 'string') {
      const attr = /\sdata-portrait-src="/.test(next) ? 'data-portrait-alt' : 'alt';
      const value = ` ${attr}="${escapeAttr(img.alt)}"`;
      const has = new RegExp(`\\s${attr}="[^"]*"`);
      next = has.test(next) ? next.replace(has, () => value) : next.replace(/\s*\/?>$/, (end) => `${value}${end}`);
    }
    // Mondbild: Ausschnitt und Zoom als Klassen (nur wenn das CMS etwas gewählt hat)
    if (/\sclass="moon-img[^"]*"/.test(next) && hasCrop(img)) {
      next = next.replace(/\sclass="moon-img[^"]*"/, () => ` class="${moonClass(img)}"`);
    }
    const isHidden = HIDDEN_ATTR.test(next);
    if (img.hidden && !isHidden) next = next.replace(/\s*\/?>$/, (end) => ` hidden${end.trim() === '/>' ? ' />' : '>'}`);
    if (!img.hidden && isHidden) next = next.replace(HIDDEN_ATTR, '');
    if (next !== tag) {
      out = out.slice(0, index) + next + out.slice(index + tag.length);
      changed++;
    }
  }
  for (const [from, to] of moved) {
    out = out.replace(new RegExp(`href="${rx(from)}"([^>]*data-lightbox)`), (_, rest) => `href="${to}"${rest}`);
  }
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
 * Zeilen, die das CMS entfernen kann: das Element mit data-cms-row="<schlüssel>"
 * (People: je Buch ein <li>, Schlüssel = sein Titel). hidden am Schlüssel im CMS
 * → Attribut hidden an der Zeile; das Element bleibt stehen (wieder einblendbar),
 * site.css blendet [hidden] aus. Ohne Angabe ist die Zeile sichtbar.
 */
export function setRows(html, keys) {
  let out = html;
  let changed = 0;
  for (const k of keys) {
    const at = out.indexOf(` data-cms-row="${k.key}"`);
    if (at < 0) continue;
    const start = out.lastIndexOf('<', at);
    const end = out.indexOf('>', at) + 1;
    const tag = out.slice(start, end);
    const isHidden = HIDDEN_ATTR.test(tag);
    let next = tag;
    if (k.hidden === true && !isHidden) next = tag.replace(/>$/, () => ' hidden>');
    if (k.hidden !== true && isHidden) next = tag.replace(HIDDEN_ATTR, '');
    if (next === tag) continue;
    out = out.slice(0, start) + next + out.slice(end);
    changed++;
  }
  return { html: out, changed };
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
