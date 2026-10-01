/**
 * Formatierte Kacheltexte (Schlüssel *.panel.<id>.text) — eine kleine, feste
 * Schreibweise statt HTML:
 *
 *   **fett**   *kursiv*   [Linktext](https://… | /pages/… | mailto:…)
 *   - Zeile mit Strich am Anfang   → Aufzählung (aufeinanderfolgende Zeilen = eine Liste)
 *   Leerzeile                      → neuer Absatz; jede weitere Leerzeile eine Zeile mehr Abstand (höchstens 3)
 *   einzelner Zeilenumbruch        → Zeilenumbruch im Absatz
 *   \* \[ \] \( \) \- \\           → das Zeichen selbst (z. B. „5\*3“ ist 5*3, nicht kursiv)
 *
 * Es entsteht nie freies HTML: nur p, ul/li, strong, em, a, br. Links nur mit
 * https://, mailto: oder auf eigene Seiten (/…); alles andere bleibt Text.
 *
 * Diese Datei gibt es zweimal — hier und im CMS (rethink-cms src/rich-text.js).
 * Beide müssen gleich bleiben; der Test tests/unit/rich-text-parity.test.js im
 * CMS vergleicht sie.
 */

/**
 * Welche Schlüssel formatiert werden dürfen: die Fließtexte unter „Learn more“ —
 * Kacheltexte (*.panel.<id>.text) und die Absätze der Founder-Kachel (*.profile.p<n>).
 * Überschriften, Knöpfe und Listenzeilen bleiben schlichter Text.
 */
export const isRichKey = (key) => /\.panel\.[a-z0-9-]+\.text$|\.profile\.p[0-9]+$/.test(String(key ?? ''));

// Eigene Seite = ein Schrägstrich, dann KEIN zweiter und kein Backslash:
// „//fremd.example“ und „/\fremd.example“ lösen Browser als fremde Domain auf.
const SAFE_HREF = /^(https:\/\/[^\s<>"]+|mailto:[^\s<>"]+|\/(?![/\\])[^\s<>"\\]*)$/;

/** Inline: Maskierung, fett, kursiv, Links, Zeilenumbruch. */
function parseInline(src) {
  const out = [];
  // Reihenfolge zählt: erst „\x“ (Zeichen wörtlich), dann fett, kursiv, Link.
  // Ein maskiertes Sternchen schließt kein fett/kursiv ((?<=[^…\\]) vor dem Stern).
  // Schließendes ** darf nach Leerraum stehen („**fett **“, „**fett⏎**“ — so entsteht es, wenn die
  // Markierung ein Leerzeichen oder den Zeilenumbruch mitnimmt); nur nicht maskiert (\**).
  const re = /\\([\\*[\]()-])|\*\*(?=\S)([\s\S]+?)(?<!\\)\*\*|\*(?=[^\s*])([\s\S]+?)(?<=[^\s*\\])\*|\[((?:\\.|[^\]\n\\])+)\]\(([^)\s]+)\)|\n/g;
  let last = 0;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (m.index > last) out.push({ type: 'text', text: src.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ type: 'text', text: m[1] });
    else if (m[2] !== undefined) {
      // Leerraum am Ende gehört nicht ins Fette: Leerzeichen bleibt dahinter, ein Umbruch
      // wird einer — außer es folgt ohnehin einer (sonst entstünde eine Leerzeile).
      const body = m[2].replace(/\s+$/, '');
      const trail = m[2].slice(body.length);
      out.push({ type: 'strong', children: parseInline(body) });
      if (trail.includes('\n')) { if (src[re.lastIndex] !== '\n') out.push({ type: 'br' }); } else if (trail) out.push({ type: 'text', text: ' ' });
    }
    else if (m[3] !== undefined) out.push({ type: 'em', children: parseInline(m[3]) });
    else if (m[4] !== undefined) {
      out.push(SAFE_HREF.test(m[5])
        ? { type: 'a', href: m[5], children: parseInline(m[4]) }
        : { type: 'text', text: m[0] });
    } else out.push({ type: 'br' });
    last = re.lastIndex;
  }
  if (last < src.length) out.push({ type: 'text', text: src.slice(last) });
  return out;
}

const LIST_ITEM = /^\s*[-•]\s+/;
/** Höchstens so viele zusätzliche Leerzeilen zwischen zwei Absätzen (CSS-Regeln für 1–3). */
export const MAX_GAP = 3;

/**
 * Text → Blöcke: [{ type: 'p', children }, { type: 'ul', items: [children] }]
 */
export function parseRich(text) {
  const blocks = [];
  // Leerzeile = neuer Absatz; jede weitere Leerzeile = eine Zeile mehr Abstand (gap, höchstens MAX_GAP),
  // damit die Seite zeigt, was im Textfeld steht. Ungerade Teile sind die Trenner.
  const parts = String(text ?? '').replace(/\r\n?/g, '\n').split(/(\n(?:[ \t]*\n)+)/);
  let gap = 0;
  for (let p = 0; p < parts.length; p++) {
    if (p % 2) { gap = Math.min(MAX_GAP, gap + parts[p].split('\n').length - 3); continue; }
    const first = blocks.length;
    const lines = parts[p].split('\n');
    let buf = [];
    const flush = () => {
      const body = buf.join('\n').trim();
      if (body) blocks.push({ type: 'p', children: parseInline(body) });
      buf = [];
    };
    for (let i = 0; i < lines.length; i++) {
      if (LIST_ITEM.test(lines[i])) {
        flush();
        const items = [];
        while (i < lines.length && LIST_ITEM.test(lines[i])) items.push(parseInline(lines[i++].replace(LIST_ITEM, '').trim()));
        i--;
        blocks.push({ type: 'ul', items });
      } else buf.push(lines[i]);
    }
    flush();
    if (blocks.length > first) {
      // Abstand nur zwischen Blöcken, nicht vor dem ersten
      if (gap > 0 && first > 0) blocks[first].gap = gap;
      gap = 0;
    }
  }
  return blocks;
}

/** Zusätzliche Leerzeilen als Attribut; Abstand in site.css (.panel-text [data-gap]) und im CMS (.rich-preview). */
const gapAttr = (b) => (b.gap ? ` data-gap="${b.gap}"` : '');

const esc =(s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const external = (href) => href.startsWith('https://');

function inlineHtml(nodes) {
  return nodes.map((n) => {
    if (n.type === 'text') return esc(n.text);
    if (n.type === 'br') return '<br>';
    if (n.type === 'strong') return `<strong>${inlineHtml(n.children)}</strong>`;
    if (n.type === 'em') return `<em>${inlineHtml(n.children)}</em>`;
    const extra = external(n.href) ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${esc(n.href)}"${extra}>${inlineHtml(n.children)}</a>`;
  }).join('');
}

/** Als HTML-Text (für die statischen Seiten beim Übernehmen aus dem CMS). */
export function renderRichHtml(text) {
  return parseRich(text).map((b) => (b.type === 'p'
    ? `<p${gapAttr(b)}>${inlineHtml(b.children)}</p>`
    : `<ul${gapAttr(b)}>${b.items.map((it) => `<li>${inlineHtml(it)}</li>`).join('')}</ul>`)).join('');
}

function inlineDom(doc, nodes, parent) {
  for (const n of nodes) {
    if (n.type === 'text') { parent.append(doc.createTextNode(n.text)); continue; }
    if (n.type === 'br') { parent.append(doc.createElement('br')); continue; }
    const tag = n.type === 'a' ? 'a' : n.type;
    const node = doc.createElement(tag);
    if (n.type === 'a') {
      node.setAttribute('href', n.href);
      if (external(n.href)) { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener'); }
    }
    inlineDom(doc, n.children, node);
    parent.append(node);
  }
}

/** In ein Element schreiben (Laufzeit der Website, Vorschau im CMS) — ohne innerHTML. */
export function renderRichInto(el, text) {
  const doc = el.ownerDocument;
  el.replaceChildren();
  for (const b of parseRich(text)) {
    const node = doc.createElement(b.type);
    if (b.gap) node.setAttribute('data-gap', String(b.gap));
    if (b.type === 'p') inlineDom(doc, b.children, node);
    else {
      for (const it of b.items) {
        const li = doc.createElement('li');
        inlineDom(doc, it, li);
        node.append(li);
      }
    }
    el.append(node);
  }
}

function inlinePlain(nodes) {
  return nodes.map((n) => (n.type === 'text' ? n.text : n.type === 'br' ? '\n' : inlinePlain(n.children))).join('');
}

/** Ohne Schreibweise, lesbar (Chatbot-Wissen, Vergleiche): Absätze durch Leerzeilen, Listen mit „- “. */
export function richToPlain(text) {
  return parseRich(text).map((b, i) => (i ? '\n\n' + '\n'.repeat(b.gap ?? 0) : '') + (b.type === 'p'
    ? inlinePlain(b.children)
    : b.items.map((it) => `- ${inlinePlain(it)}`).join('\n'))).join('');
}
