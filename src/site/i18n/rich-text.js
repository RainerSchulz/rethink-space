/**
 * Formatierte Kacheltexte (Schlüssel *.panel.<id>.text) — eine kleine, feste
 * Schreibweise statt HTML:
 *
 *   **fett**   *kursiv*   [Linktext](https://… | /pages/… | mailto:…)
 *   - Zeile mit Strich am Anfang   → Aufzählung (aufeinanderfolgende Zeilen = eine Liste)
 *   Leerzeile                      → neuer Absatz
 *   einzelner Zeilenumbruch        → Zeilenumbruch im Absatz
 *
 * Es entsteht nie freies HTML: nur p, ul/li, strong, em, a, br. Links nur mit
 * https://, mailto: oder auf eigene Seiten (/…); alles andere bleibt Text.
 *
 * Diese Datei gibt es zweimal — hier und im CMS (rethink-cms src/rich-text.js).
 * Beide müssen gleich bleiben; der Test tests/unit/rich-text-parity.test.js im
 * CMS vergleicht sie.
 */

/** Welche Schlüssel formatiert werden dürfen: nur die Texte unter „Learn more“. */
export const isRichKey = (key) => /\.panel\.[a-z0-9-]+\.text$/.test(String(key ?? ''));

const SAFE_HREF = /^(https:\/\/[^\s<>"]+|mailto:[^\s<>"]+|\/[^\s<>"]*)$/;

/** Inline: fett, kursiv, Links, Zeilenumbruch. */
function parseInline(src) {
  const out = [];
  const re = /\*\*(?=\S)([\s\S]+?)(?<=\S)\*\*|\*(?=[^\s*])([\s\S]+?)(?<=[^\s*])\*|\[([^\]\n]+)\]\(([^)\s]+)\)|\n/g;
  let last = 0;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (m.index > last) out.push({ type: 'text', text: src.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ type: 'strong', children: parseInline(m[1]) });
    else if (m[2] !== undefined) out.push({ type: 'em', children: parseInline(m[2]) });
    else if (m[3] !== undefined) {
      out.push(SAFE_HREF.test(m[4])
        ? { type: 'a', href: m[4], children: parseInline(m[3]) }
        : { type: 'text', text: m[0] });
    } else out.push({ type: 'br' });
    last = re.lastIndex;
  }
  if (last < src.length) out.push({ type: 'text', text: src.slice(last) });
  return out;
}

const LIST_ITEM = /^\s*[-•]\s+/;

/**
 * Text → Blöcke: [{ type: 'p', children }, { type: 'ul', items: [children] }]
 */
export function parseRich(text) {
  const blocks = [];
  const paragraphs = String(text ?? '').replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/);
  for (const para of paragraphs) {
    const lines = para.split('\n');
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
  }
  return blocks;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
    ? `<p>${inlineHtml(b.children)}</p>`
    : `<ul>${b.items.map((it) => `<li>${inlineHtml(it)}</li>`).join('')}</ul>`)).join('');
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
    if (b.type === 'p') {
      const p = doc.createElement('p');
      inlineDom(doc, b.children, p);
      el.append(p);
    } else {
      const ul = doc.createElement('ul');
      for (const it of b.items) {
        const li = doc.createElement('li');
        inlineDom(doc, it, li);
        ul.append(li);
      }
      el.append(ul);
    }
  }
}

function inlinePlain(nodes) {
  return nodes.map((n) => (n.type === 'text' ? n.text : n.type === 'br' ? '\n' : inlinePlain(n.children))).join('');
}

/** Ohne Schreibweise, lesbar (Chatbot-Wissen, Vergleiche): Absätze durch Leerzeilen, Listen mit „- “. */
export function richToPlain(text) {
  return parseRich(text).map((b) => (b.type === 'p'
    ? inlinePlain(b.children)
    : b.items.map((it) => `- ${inlinePlain(it)}`).join('\n'))).join('\n\n');
}
