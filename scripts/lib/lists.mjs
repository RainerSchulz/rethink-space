/**
 * Listen, die das CMS verwaltet (People: Publikationen): hinzufügen, löschen,
 * Reihenfolge ändern.
 *
 * Der verwaltete Bereich steht in der Seite zwischen
 *   <!-- cms:list <name> -->  …  <!-- /cms:list -->
 * (name = Schlüssel-Präfix, z. B. „people.books“). Jede Zeile darin ist ein
 * Eintrag; seine Texte hängen an Schlüsseln <name>.<id>.<feld> (People:
 * „title“ und „meta“), die Zeile trägt data-cms-row="<name>.<id>.<erstes feld>"
 * (im CMS ausblendbar, apply.mjs setRows).
 *
 * Wie bei den Kacheln (bands.mjs): bestehende Einträge werden samt ihrem HTML
 * übernommen und nur umsortiert oder entfernt; neue entstehen aus dem ersten
 * Eintrag als Vorlage (andere Kennung, eigene Texte, sichtbar, ohne lang).
 * Texte setzt danach wie überall applyKeysToHtml.
 *
 * Reine Umformungen ohne Dateizugriff, getestet in tests/unit/lists.test.js.
 */
import { escapeHtml } from './apply.mjs';

const START = /^\s*<!-- cms:list ([a-z][a-z0-9-]*(?:\.[a-z0-9-]+)*) -->\s*$/;
const END = /^\s*<!-- \/cms:list -->\s*$/;
export const ID_RE = /^[a-z0-9-]+$/;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Ein Eintrag (eine Zeile): Kennung und Felder aus den Schlüsseln. */
function parseItem(name, line) {
  const re = new RegExp(`data-i18n="${escapeRe(name)}\\.([a-z0-9-]+)\\.([a-z0-9-]+)"`, 'g');
  const found = [...line.matchAll(re)];
  if (!found.length) return null;
  const id = found[0][1];
  return { id, line, fields: found.filter((m) => m[1] === id).map((m) => m[2]) };
}

/**
 * Alle verwalteten Listen einer Seite.
 * @returns {{ name: string, from: number, to: number, items: {id:string, line:string, fields:string[]}[] }[]}
 *   from/to: Zeilennummern der Marker (0-basiert)
 */
export function findLists(html) {
  const lines = html.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = START.exec(lines[i]);
    if (!m) continue;
    let j = i + 1;
    while (j < lines.length && !END.test(lines[j])) j++;
    if (j >= lines.length) break; // ohne Ende: nichts anfassen
    const items = lines.slice(i + 1, j).filter((l) => l.trim()).map((l) => parseItem(m[1], l)).filter(Boolean);
    out.push({ name: m[1], from: i, to: j, items });
    i = j;
  }
  return out;
}

/** Neuer Eintrag aus der Vorlage: andere Kennung, eigene Texte, sichtbar, ohne Sprachangabe. */
export function renderItem(name, template, id, text = () => undefined) {
  let line = template.line.split(`${name}.${template.id}.`).join(`${name}.${id}.`);
  line = line.replace(/(<li\b[^>]*?)\shidden(?:="[^"]*")?(?=[\s>])/, '$1');
  line = line.replace(/\slang="[a-zA-Z-]+"/g, '');
  for (const f of template.fields) {
    const key = `${name}.${id}.${f}`;
    const re = new RegExp(`(data-i18n="${escapeRe(key)}"[^>]*>)[^<]*(<)`);
    line = line.replace(re, (all, open, close) => `${open}${escapeHtml(text(key) ?? '')}${close}`);
  }
  return line;
}

/**
 * Listen nach dem Stand des CMS neu zusammensetzen.
 * @param {string} html  ganze Seite
 * @param {Record<string, {id:string}[]>} lists  je Liste die Einträge in CMS-Reihenfolge;
 *   fehlt eine Liste, bleibt sie, wie sie ist
 * @param {(key:string) => string|undefined} text  englischer Text je Schlüssel (für neue Einträge)
 * @returns {{ html: string, changed: boolean, added: {name:string,id:string,keys:string[]}[],
 *   removed: {name:string,id:string,keys:string[]}[], notes: string[] }}
 */
export function applyLists(html, lists, text = () => undefined) {
  const lines = html.split('\n');
  const added = [];
  const removed = [];
  const notes = [];
  // Von hinten nach vorn: so bleiben die Zeilennummern der vorderen Listen gültig.
  for (const list of findLists(html).reverse()) {
    const wanted = lists?.[list.name];
    if (!Array.isArray(wanted)) continue;
    const byId = new Map(list.items.map((it) => [it.id, it]));
    const template = list.items[0];
    const next = [];
    for (const { id } of wanted) {
      if (!ID_RE.test(id ?? '')) { notes.push(`${list.name}: Eintrag „${id}“ hat keine gültige Kennung — übersprungen`); continue; }
      const old = byId.get(id);
      if (old) { next.push(old.line); continue; }
      if (!template) { notes.push(`${list.name}: kein Eintrag als Vorlage — „${id}“ übersprungen`); continue; }
      next.push(renderItem(list.name, template, id, text));
      added.push({ name: list.name, id, keys: template.fields.map((f) => `${list.name}.${id}.${f}`) });
    }
    const keep = new Set(wanted.map((w) => w.id));
    for (const it of list.items) {
      if (!keep.has(it.id)) removed.push({ name: list.name, id: it.id, keys: it.fields.map((f) => `${list.name}.${it.id}.${f}`) });
    }
    lines.splice(list.from + 1, list.to - list.from - 1, ...next);
  }
  const out = lines.join('\n');
  return { html: out, changed: out !== html, added, removed, notes };
}
