/**
 * Feature: formatierte Kacheltexte (src/site/i18n/rich-text.js)
 * Fett, kursiv, Links, Aufzählungen — aus einer festen Schreibweise, nie aus HTML.
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isRichKey, parseRich, renderRichHtml, renderRichInto, richToPlain } from '../../src/site/i18n/rich-text.js';

describe('Feature: formatierte Kacheltexte', () => {
  it('nur die Texte unter „Learn more“ sind formatierbar', () => {
    expect(isRichKey('habitat.panel.space.text')).toBe(true);
    expect(isRichKey('people.panel.team.text')).toBe(true);
    expect(isRichKey('habitat.band.space')).toBe(false);
    expect(isRichKey('footer.project')).toBe(false);
  });

  it('Absätze, Zeilenumbrüche, fett und kursiv', () => {
    expect(renderRichHtml('Eins **fett** und *kursiv*.\nZweite Zeile.\n\nNeuer Absatz.'))
      .toBe('<p>Eins <strong>fett</strong> und <em>kursiv</em>.<br>Zweite Zeile.</p><p>Neuer Absatz.</p>');
    expect(renderRichHtml('**fett mit *kursiv* drin**')).toBe('<p><strong>fett mit <em>kursiv</em> drin</strong></p>');
  });

  it('Aufzählungen aus Zeilen mit Strich', () => {
    expect(renderRichHtml('Ziele:\n- 60 % ISRU\n- **80–90 %** mit LUNAR HABITATO\n\nDanach.'))
      .toBe('<p>Ziele:</p><ul><li>60 % ISRU</li><li><strong>80–90 %</strong> mit LUNAR HABITATO</li></ul><p>Danach.</p>');
  });

  it('Links nur auf https, mailto und eigene Seiten — extern in neuem Tab', () => {
    expect(renderRichHtml('[Paper](https://example.org/a.pdf)'))
      .toBe('<p><a href="https://example.org/a.pdf" target="_blank" rel="noopener">Paper</a></p>');
    expect(renderRichHtml('[Team](/pages/people/)')).toBe('<p><a href="/pages/people/">Team</a></p>');
    expect(renderRichHtml('[x](javascript:alert(1))')).not.toContain('<a');
    expect(renderRichHtml('[x](http://unsicher.example)')).not.toContain('<a');
  });

  it('„eigene Seite“ heißt eigene Domain — //, /\\ und /// bleiben Text (Befund rethink-space-dc)', () => {
    for (const href of ['//evil.example/phish', String.raw`/\evil.example/phish`, '///evil.example', String.raw`/pages\x`]) {
      expect(renderRichHtml(`[klick](${href})`), href).not.toContain('<a');
    }
    for (const href of ['/pages/contact/', '/Bilder/x.jpg', '/']) {
      expect(renderRichHtml(`[klick](${href})`), href).toContain(`<a href="${href}">`);
    }
    // aufgelöst gegen die eigene Adresse bleibt jeder erlaubte relative Link auf rethink.space
    const hrefs = [...renderRichHtml('[a](/pages/x/) [b](/y)').matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    for (const h of hrefs) expect(new URL(h, 'https://rethink.space/').host).toBe('rethink.space');
  });

  it('HTML im Text bleibt Text', () => {
    expect(renderRichHtml('<script>x</script> & "Zitat"')).toBe('<p>&lt;script&gt;x&lt;/script&gt; &amp; &quot;Zitat&quot;</p>');
  });

  it('einzelne Sternchen und Rechenzeichen bleiben stehen', () => {
    expect(renderRichHtml('5 * 3 = 15 und 1M $ / kg')).toBe('<p>5 * 3 = 15 und 1M $ / kg</p>');
    expect(parseRich('')).toEqual([]);
  });

  it('DOM-Ausgabe entspricht der HTML-Ausgabe (Laufzeit = statische Seite)', () => {
    const src = 'A **b** *c* [d](/pages/x/)\n- e\n- f\n\ng';
    const el = document.createElement('div');
    renderRichInto(el, src);
    expect(el.innerHTML).toBe(renderRichHtml(src));
  });

  it('als reiner Text lesbar (Chatbot-Wissen)', () => {
    expect(richToPlain('Eins **fett**.\n\n- a\n- [b](https://x.org)')).toBe('Eins fett.\n\n- a\n- b');
  });
});

describe('Feature: Bedingungen, an denen die Übernahme hängt', () => {
  it('erzeugt nie ein <div> — setElementText sucht bis zum ersten </div> des Kachel-Elements', () => {
    const wild = '**a** *b*\n- c\n- [d](https://x.org)\n\n<div>e</div> </div> [f](/g)\n\n- h';
    expect(renderRichHtml(wild)).not.toMatch(/<div/i);
    expect(renderRichHtml(wild)).not.toMatch(/<\/div/i);
  });

  // Dieselbe Datei steht im CMS (rethink-cms src/rich-text.js) mit derselben
  // Prüfsumme. Ändert sich eine Kopie, schlägt dieser Test an — dann beide
  // Dateien angleichen und die Summe hier UND im CMS-Test erneuern.
  it('ist unverändert gegenüber der Kopie im CMS (Prüfsumme)', () => {
    const file = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/site/i18n/rich-text.js');
    const src = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    expect(createHash('sha256').update(src).digest('hex')).toBe('23111ebd1af38a0ca1ecf3e3b1972dd3c67fe285d1f5fdc0a2d2f62587db01e0');
  });
});

describe('Feature: Fett, auch wenn vor dem schließenden ** Leerraum steht', () => {
  it('„**fett **“ und „**fett\n**“ werden fett — Leerraum steht dahinter, keine Leerzeile', () => {
    expect(renderRichHtml('**Letters of Intent by: **')).toBe('<p><strong>Letters of Intent by:</strong> </p>');
    expect(renderRichHtml('**-Politecnico study.\n**\nEarly validation:'))
      .toBe('<p><strong>-Politecnico study.</strong><br>Early validation:</p>');
    expect(renderRichHtml('**fett\n**weiter')).toBe('<p><strong>fett</strong><br>weiter</p>');
  });

  it('bleibt wörtlich, wo kein Fett gemeint ist', () => {
    expect(renderRichHtml('5 ** 3')).toBe('<p>5 ** 3</p>');
    expect(renderRichHtml('**a** und **b**')).toBe('<p><strong>a</strong> und <strong>b</strong></p>');
    expect(renderRichHtml('2 * 3 * 4')).toBe('<p>2 * 3 * 4</p>');
  });
});

describe('Feature: Leerzeilen wie im Textfeld (CMS und Website gleich)', () => {
  it('eine Leerzeile = Absatz, jede weitere = data-gap (höchstens 3), nicht vor dem ersten Block', () => {
    expect(renderRichHtml('a\n\nb')).toBe('<p>a</p><p>b</p>');
    expect(renderRichHtml('Text\n\n\nJuly 2026')).toBe('<p>Text</p><p data-gap="1">July 2026</p>');
    expect(renderRichHtml('a\n\n\n\n\n\n\nb')).toBe('<p>a</p><p data-gap="3">b</p>');
    expect(renderRichHtml('\n\n\nstart')).toBe('<p>start</p>');
    expect(renderRichHtml('a\n\n\n- x\n- y')).toBe('<p>a</p><ul data-gap="1"><li>x</li><li>y</li></ul>');
    expect(richToPlain('Text\n\n\nJuly 2026')).toBe('Text\n\n\nJuly 2026');
  });

  it('DOM (Laufzeit, CMS-Vorschau) und HTML (Übernahme) ergeben dasselbe', () => {
    const el = document.createElement('div');
    for (const s of ['Text\n\n\nJuly 2026', 'a\n\n\n\n- x\n- y\n\nb', '**f**\n\n\n*k*']) {
      renderRichInto(el, s);
      expect(el.innerHTML, s).toBe(renderRichHtml(s));
    }
  });

  it('site.css hat für jede mögliche Stufe eine Regel', async () => {
    const { MAX_GAP } = await import('../../src/site/i18n/rich-text.js');
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../src/site/site.css'), 'utf8');
    for (let g = 1; g <= MAX_GAP; g++) expect(css, `data-gap="${g}"`).toContain(`.panel-text > [data-gap="${g}"]`);
  });
});
