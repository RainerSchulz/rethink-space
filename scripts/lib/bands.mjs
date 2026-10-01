/**
 * Kacheln („Bänder“), die das CMS verwaltet: hinzufügen, löschen, verschieben.
 *
 * Der verwaltete Bereich steht in der Seite zwischen
 *   <!-- cms:bands -->  …  <!-- /cms:bands -->
 * und besteht aus lauter gleich gebauten <div class="band-group">: Bild, Titel,
 * „Learn more“, aufklappbarer Text. Was nicht in diesem Bereich steht (etwa die
 * Founder-Kachel auf /pages/people/ mit Porträt und Buchliste), bleibt Code.
 *
 * Bestehende Kacheln werden nicht neu erzeugt, sondern samt ihrem HTML
 * übernommen, verschoben oder entfernt — so bleiben Besonderheiten wie das
 * Hochformat-Bild für Handys (<picture>) oder Zusatzklassen erhalten. Nur neue
 * Kacheln entstehen aus der Vorlage. Wird ein Bild getauscht, wird daraus ein
 * schlichtes <img>. Texte setzt danach wie überall applyKeyToHtml.
 *
 * Reine Umformungen ohne Dateizugriff, getestet in tests/unit/bands.test.js.
 */
import { renderRichHtml } from '../../src/site/i18n/rich-text.js';
import { escapeHtml, escapeJsString } from './apply.mjs';

export const REGION_START = '<!-- cms:bands -->';
export const REGION_END = '<!-- /cms:bands -->';
const GROUP_OPEN = '        <div class="band-group">';
/** Bildausschnitt aus dem CMS → Klasse (Regel 10: Ausschnitt statt Sonderformat). */
export const FOCUS_CLASS = { top: ' band-media--top', center: '', bottom: ' band-media--bottom' };
const mediaClass = (focus) => `band-media${FOCUS_CLASS[focus] ?? ''}`;
const GROUP_CLOSE = '        </div>';

/** Seite in Teil vor, im und nach dem verwalteten Bereich zerlegen; null ohne Bereich. */
export function splitRegion(html) {
  const a = html.indexOf(REGION_START);
  const b = html.indexOf(REGION_END);
  if (a < 0 || b < a) return null;
  const startLineEnd = html.indexOf('\n', a) + 1;
  const endLineStart = html.lastIndexOf('\n', b) + 1;
  return {
    before: html.slice(0, startLineEnd),
    region: html.slice(startLineEnd, endLineStart),
    after: html.slice(endLineStart),
  };
}

/** Kacheln des Bereichs in Reihenfolge: HTML-Block, id, Schlüssel, Bild. */
export function parseBands(region) {
  const lines = region.split('\n');
  const blocks = [];
  let current = null;
  for (const line of lines) {
    if (line === GROUP_OPEN) current = [line];
    else if (current) {
      current.push(line);
      if (line === GROUP_CLOSE) { blocks.push(current.join('\n')); current = null; }
    }
  }
  return blocks.map((block) => {
    const id = /aria-controls="band-([^"]+)"/.exec(block)?.[1];
    const titleKey = /class="band-h" data-i18n="([^"]+)"/.exec(block)?.[1];
    const textKey = /class="panel-text" data-i18n="([^"]+)"/.exec(block)?.[1];
    const src = /<img class="band-media[^"]*" src="([^"]+)"/.exec(block)?.[1];
    const more = /data-i18n="common\.more">([^<]*)</.exec(block)?.[1];
    return { id, titleKey, textKey, image: { src }, more, block };
  });
}

/** Kachel ohne Bild: dunkle Fläche in gleicher Höhe (site.css .band--plain). */
const PLAIN = 'band--plain';
const bandImg = (src, cls) => `<img class="${cls}" src="${escapeHtml(src)}" alt="" loading="lazy">`;

/** Neue Kachel aus der Vorlage (derselbe Aufbau wie die bestehenden); ohne Bild mit Klasse band--plain. */
export function renderBand({ id, titleKey, textKey, title = '', text = '', image }, { more = 'Learn more' } = {}) {
  const src = image?.src;
  return [
    GROUP_OPEN,
    src ? '          <div class="band">' : `          <div class="band ${PLAIN}">`,
    src ? `            ${bandImg(src, mediaClass(image.focus))}` : null,
    '            <div class="band-title">',
    `              <h2 class="band-h" data-i18n="${titleKey}">${escapeHtml(title)}</h2>`,
    `              <button class="arrow-link band-toggle" type="button" aria-expanded="false" aria-controls="band-${id}" data-i18n="common.more">${escapeHtml(more)}</button>`,
    '            </div>',
    '          </div>',
    `          <div class="band-panel" id="band-${id}" hidden>`,
    `            <div class="panel-text" data-i18n="${textKey}">${renderRichHtml(text)}</div>`,
    '          </div>',
    GROUP_CLOSE,
  ].filter((l) => l !== null).join('\n');
}

/** Überschrift eines Blocks auf h1/h2 setzen (die Seite hat genau eine h1). */
function setHeading(block, tag) {
  return block.replace(/<(h[12]) class="band-h"([^>]*)>([\s\S]*?)<\/\1>/, `<${tag} class="band-h"$2>$3</${tag}>`);
}

/**
 * Bild eines bestehenden Blocks tauschen; aus <picture> wird ein schlichtes <img>.
 * focus (top/center/bottom) setzt den Ausschnitt; ohne Angabe bleibt die
 * vorhandene Klasse (etwa band-media--partnership) stehen.
 * src leer = Kachel ohne Bild: Bild raus, Klasse band--plain; kommt wieder ein
 * Bild, wandert es an den Anfang der Kachel und band--plain fällt weg.
 */
function setImage(block, src, focus) {
  const img = /<img class="(band-media[^"]*)" src="([^"]+)"[^>]*>/.exec(block);
  const picture = /\n( *)<picture>[\s\S]*?<\/picture>/.exec(block);
  if (!src) {
    if (!img && !picture) return block;
    const without = picture
      ? block.replace(picture[0], () => '')
      : block.split('\n').filter((line) => !line.includes(img[0])).join('\n');
    return without.replace('<div class="band">', () => `<div class="band ${PLAIN}">`);
  }
  if (!img) {
    // Kachel hatte kein Bild: Bild vor die Titelzeile, Klasse band--plain weg
    return block
      .replace(`<div class="band ${PLAIN}">`, () => '<div class="band">')
      .replace(/\n( *)<div class="band-title">/, (all, indent) => `\n${indent}${bandImg(src, mediaClass(focus))}${all}`);
  }
  const cls = focus ? mediaClass(focus) : img[1];
  if (img[2] === src && cls === img[1]) return block;
  const plain = bandImg(src, cls);
  // Ersetzung als Funktion: Pfade und Texte aus dem CMS dürfen $-Zeichen enthalten.
  if (picture) return block.replace(picture[0], () => `\n${picture[1]}${plain}`);
  return block.replace(img[0], () => plain);
}

/**
 * Den Bereich nach der Liste des CMS neu zusammensetzen.
 * @param {string} html   ganze Seite
 * @param {{id:string,titleKey:string,textKey:string,image:{src:string|null}|null}[]} bands  Reihenfolge aus dem CMS;
 *   image.src leer/null = Kachel ohne Bild, image fehlt ganz (undefined) = Bild bleibt, wie es ist
 * @param {(key:string) => string|undefined} text   englischer Text je Schlüssel (für neue Kacheln)
 * @returns {{ html: string, changed: boolean, added: string[], removed: string[], skipped?: string }}
 */
export function applyBands(html, bands, text = () => undefined) {
  const parts = splitRegion(html);
  if (!parts) return { html, changed: false, added: [], removed: [], skipped: 'kein Bereich <!-- cms:bands -->' };
  const existing = parseBands(parts.region);
  const byId = new Map(existing.map((b) => [b.id, b]));
  const more = existing.find((b) => b.more)?.more ?? 'Learn more';
  // Die erste Kachel trägt die h1 — außer die Seite hat schon eine davor (People: Founder).
  const firstTag = /<h1\b/.test(parts.before) || /<h1\b/.test(parts.after) ? 'h2' : 'h1';

  const blocks = bands.map((b, i) => {
    const tag = i === 0 ? firstTag : 'h2';
    const old = byId.get(b.id);
    const block = old
      ? setImage(old.block, b.image === undefined ? old.image.src : (b.image?.src || null), b.image?.focus)
      : renderBand({ ...b, title: text(b.titleKey) ?? '', text: text(b.textKey) ?? '' }, { more });
    return setHeading(block, tag);
  });

  const region = blocks.length ? `${blocks.join('\n')}\n` : '';
  const out = parts.before + region + parts.after;
  const ids = new Set(bands.map((b) => b.id));
  return {
    html: out,
    changed: out !== html,
    added: bands.filter((b) => !byId.has(b.id)).map((b) => b.id),
    removed: existing.filter((b) => !ids.has(b.id)).map((b) => b.id),
  };
}

/** Bereich für die Bildzuordnung nach Position ausblenden (Kachel-Bilder zählen nicht mit). */
export function maskRegion(html) {
  const parts = splitRegion(html);
  if (!parts) return { masked: html, restore: (h) => h };
  const token = '\u0000CMS_BANDS\u0000';
  return {
    masked: parts.before + token + parts.after,
    // Funktion statt Text: der Bereich enthält Kacheltexte, $&, $$ oder $' darin blieben sonst nicht stehen.
    restore: (h) => h.replace(token, () => parts.region),
  };
}

/* ---------- Wörterbücher: Schlüssel neuer Kacheln anlegen, gelöschter entfernen ---------- */

/** Wörterbuch-Zeichenkette — dieselbe Maskierung wie setDictValue (apply.mjs escapeJsString). */
export function dictEscape(value) {
  return escapeJsString(value);
}

/**
 * Schlüssel nach der letzten Zeile mit gleichem Präfix einfügen (etwa nach
 * 'habitat.panel.…'), damit die Wörterbücher nach Seiten gegliedert bleiben.
 * Vorhandene Schlüssel bleiben unberührt. Gibt die Zahl der neuen Zeilen zurück.
 */
export function insertDictKeys(lines, entries, prefix) {
  let added = 0;
  for (const { key, value } of entries) {
    if (lines.some((l) => l.trimStart().startsWith(`'${key}':`))) continue;
    let at = -1;
    lines.forEach((l, i) => { if (l.trimStart().startsWith(`'${prefix}`)) at = i; });
    if (at < 0) at = lines.findIndex((l) => l.trim() === '};') - 1;
    lines.splice(at + 1, 0, `  '${key}': '${dictEscape(value)}',`);
    added++;
  }
  return added;
}

export function removeDictKey(lines, key) {
  const i = lines.findIndex((l) => l.trimStart().startsWith(`'${key}':`));
  if (i < 0) return false;
  lines.splice(i, 1);
  return true;
}

/** Präfix einer Seite aus einem vorhandenen Kachel-Schlüssel („habitat.band.space“ → „habitat“). */
export function prefixOf(key) {
  return String(key ?? '').split('.')[0];
}
