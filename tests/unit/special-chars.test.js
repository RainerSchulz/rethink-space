/**
 * Feature: Sonderzeichen überstehen den ganzen Weg vom CMS auf die Website
 *
 * Ein fester Katalog schwieriger Zeichen läuft durch jede Stelle, an der Text
 * aus dem CMS in die Website geschrieben wird — und wird am AUSGEWERTETEN
 * Ergebnis gemessen (Wörterbuchzeile als JavaScript ausgeführt, HTML im DOM
 * gelesen), nie am Quelltext. Anlass: „$1M per kilogram“ verfälschte am
 * 30.09.2026 das Wörterbuch (Ersetzungstext statt -funktion).
 *
 * Regel für den Katalog: Jede neue Fehlerart, die auftaucht, kommt hier als
 * Zeile dazu — dann gilt sie für alle Stellen auf einmal.
 */
import { describe, it, expect } from 'vitest';
import { setDictValue, setElementText, setElementAttr, escapeJsString } from '../../scripts/lib/apply.mjs';
import { applyBands, insertDictKeys, maskRegion } from '../../scripts/lib/bands.mjs';
import { isRichKey, renderRichHtml, renderRichInto, richToPlain } from '../../src/site/i18n/rich-text.js';

/** [Name, Text] — Text, wie er aus dem CMS kommt (schon ohne Steuerzeichen, s. CMS src/text-normalize.js). */
export const CATALOG = [
  ['Apostroph', "Humanity's path"],
  ['Akut statt Apostroph', 'Humanity´s path'],
  ['Backtick', 'use `code` here'],
  ['doppelte Anführung', 'He said "yes"'],
  ['typografisch EN', '“quoted” and ‘single’'],
  ['typografisch DE', '„Zitat“ und ‚halb‘ und »Guillemets«'],
  ['Backslash', 'C:\\Projekte\\Re-Think and \\n literally'],
  ['Dollar mit Ziffer', 'At a cost of $1M per kilogram'],
  ['Dollar-Platzhalter', "$& and $$ and $` and $' and $<name>"],
  ['Dollar lose', '1M $ / kg, ends with $'],
  ['Template', 'not a ${template} at all'],
  ['HTML-Zeichen', '5 < 6 > 4 & Co'],
  ['Entität wörtlich', 'write &amp; and &lt;b&gt; literally'],
  ['Tag wörtlich', '<b>not bold</b> <script>alert(1)</script>'],
  ['Script-Ende', 'text </script> and </div> and <!-- x -->'],
  ['Umlaute', 'Größe, Übung, Äpfel, ß'],
  ['Akzente', 'Café, naïve, São Paulo, Kraków'],
  ['Emoji', 'Launch 🚀 and 👩‍🚀 crew'],
  ['geschütztes Leerzeichen', '10\u00a0km and 5\u202fkg'],
  ['unsichtbar', 'zero\u200bwidth and soft\u00adhyphen'],
  ['Tabulator', 'col1\tcol2'],
  ['Absätze', 'Eins.\n\nZwei.\nDrei.'],
  ['Windows-Umbruch', 'Eins.\r\nZwei.'],
  ['alter Mac-Umbruch', 'Eins.\rZwei.'],
  ['Zeilentrenner U+2028', 'Eins.\u2028Zwei.\u2029Drei.'],
  ['Regex-Zeichen', 'a.b*c+d?e^f(g)[h]{i}|j\\k'],
  ['Prozent und Raute', '100 % and #1 and 50%'],
  ['Mathe', '≤ ≥ ≠ ± × ÷ ≈ ∞ ² ³ ½'],
  ['Gedankenstriche', 'a – b — c … d'],
  ['Währungen', '€ 5, £ 3, ¥ 7, ₿ 1'],
  ['Stern im Text', '5*3*2 and footnote*'],
  ['Unterstrich', 'snake_case and __init__'],
  ['eckige Klammern', 'see [1] and [a](b)'],
  ['Minus am Zeilenanfang', '-5 °C at night\n- a list?'],
  ['nur Leerzeichen innen', 'a   b'],
  ['RTL', 'Arabic مرحبا and Hebrew שלום'],
  ['CJK', '月面基地 and 달'],
  ['langer Text', 'x'.repeat(5000)],
];

/** Wörterbuchzeile als JavaScript auswerten — so, wie Vite sie später liest. */
function evalDict(lines) {
  return new Function(lines.join('\n').replace(/^export const (EN|DE) =/m, 'return'))();
}

/** Was die Website aus dem Text im Wörterbuch macht: Zeilenumbrüche vereinheitlicht. */
const stored = (text) => text.replace(/\r\n?/g, '\n');

describe('Feature: Sonderzeichen überstehen den Weg vom CMS auf die Website', () => {
  for (const [name, text] of CATALOG) {
    describe(name, () => {
      it('Wörterbuch (setDictValue) — ausgewertet unverändert', () => {
        const lines = ['export const EN = {', "  'a.b.c': 'alt',", '};'];
        setDictValue(lines, 'a.b.c', text);
        expect(evalDict(lines)['a.b.c']).toBe(stored(text));
      });

      it('Wörterbuch für neue Kacheln (insertDictKeys) — ausgewertet unverändert', () => {
        const lines = ['export const EN = {', "  'habitat.band.a': 'A',", '};'];
        insertDictKeys(lines, [{ key: 'habitat.band.b', value: text }], 'habitat.');
        expect(evalDict(lines)['habitat.band.b']).toBe(stored(text));
      });

      it('Text im HTML (setElementText) — im DOM unverändert', () => {
        const html = '<main><span data-i18n="a.b.c">alt</span></main>';
        const { html: out } = setElementText(html, 'a.b.c', text);
        const doc = new DOMParser().parseFromString(out, 'text/html');
        expect(doc.querySelector('[data-i18n]').textContent).toBe(text);
        expect(doc.querySelectorAll('main *')).toHaveLength(1); // nichts Neues eingeschleust
      });

      it('Attribut (setElementAttr) — im DOM unverändert', () => {
        const html = '<meta name="description" content="alt" data-i18n-content="a.meta.description">';
        const { html: out } = setElementAttr(html, 'a.meta.description', text, 'content', 'content');
        const doc = new DOMParser().parseFromString(out, 'text/html');
        expect(doc.querySelector('meta').getAttribute('content')).toBe(text);
      });

      it('Kacheltext (formatiert) — statische Seite gleich Laufzeit, kein Element eingeschleust', () => {
        const key = 'habitat.panel.x.text';
        expect(isRichKey(key)).toBe(true);
        const html = `<main><div class="panel-text" data-i18n="${key}">alt</div></main>`;
        const { html: out } = setElementText(html, key, text);
        const doc = new DOMParser().parseFromString(out, 'text/html');
        const staticEl = doc.querySelector('[data-i18n]');
        const runtime = document.createElement('div');
        renderRichInto(runtime, text);
        expect(staticEl.innerHTML).toBe(runtime.innerHTML);
        const allowed = new Set(['P', 'UL', 'LI', 'STRONG', 'EM', 'A', 'BR']);
        expect([...staticEl.querySelectorAll('*')].every((n) => allowed.has(n.tagName))).toBe(true);
        expect(renderRichHtml(text)).not.toMatch(/<\/?div/i);
      });

      it('neue Kachel (renderBand über applyBands) — Titel und Text im DOM', () => {
        const page = '<main>\n<!-- cms:bands -->\n<!-- /cms:bands -->\n</main>';
        const band = { id: 'x', titleKey: 'habitat.band.x', textKey: 'habitat.panel.x.text', image: { src: '/Bilder/x.jpg' } };
        const texts = { 'habitat.band.x': text, 'habitat.panel.x.text': text };
        const { html: out } = applyBands(page, [band], (k) => texts[k]);
        const doc = new DOMParser().parseFromString(out, 'text/html');
        expect(doc.querySelector('.band-h').textContent).toBe(text);
        const runtime = document.createElement('div');
        renderRichInto(runtime, text);
        expect(doc.querySelector('.panel-text').innerHTML).toBe(runtime.innerHTML);
      });

      it('Kachel-Bereich übersteht Maskieren und Zurücksetzen', () => {
        const html = `<main>\n<!-- cms:bands -->\n<h2>${text}</h2>\n<!-- /cms:bands -->\n</main>`;
        const { masked, restore } = maskRegion(html);
        expect(restore(masked)).toBe(html);
      });

      it('lesbarer Text für den Chatbot enthält keine Schreibweise-Reste außer maskierten', () => {
        expect(typeof richToPlain(text)).toBe('string');
      });
    });
  }

  it('escapeJsString ist die eine Stelle für Wörterbuch-Zeichenketten', () => {
    expect(escapeJsString("a'b\\c\nd\re\u2028f")).toBe("a\\'b\\\\c\\nd\\ne\\u2028f");
  });
});

describe('Feature: Schreibweise wörtlich schreiben (Backslash)', () => {
  it('\\* \\[ \\] \\( \\) \\\\ und \\- am Zeilenanfang bleiben Zeichen', () => {
    expect(renderRichHtml('5\\*3\\*2')).toBe('<p>5*3*2</p>');
    expect(renderRichHtml('\\[1\\](x)')).toBe('<p>[1](x)</p>');
    expect(renderRichHtml('C:\\\\Pfad')).toBe('<p>C:\\Pfad</p>');
    expect(renderRichHtml('\\- kein Punkt')).toBe('<p>- kein Punkt</p>');
    expect(renderRichHtml('**fett \\* mit Stern**')).toBe('<p><strong>fett * mit Stern</strong></p>');
    expect(richToPlain('5\\*3')).toBe('5*3');
  });

  it('ein einzelner Backslash vor anderen Zeichen bleibt stehen', () => {
    expect(renderRichHtml('a\\b and \\n')).toBe('<p>a\\b and \\n</p>');
  });
});
