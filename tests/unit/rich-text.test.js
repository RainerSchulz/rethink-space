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

describe('Feature: Schriftgröße einzelner Wörter (Inhaber 23.11.2026)', () => {
  it('{s} {l} {xl} → span mit fester Klasse, verschachtelt mit fett; ohne Marken als Text', () => {
    expect(renderRichHtml('Ein {l}großes{/l} Wort')).toBe('<p>Ein <span class="rt-l">großes</span> Wort</p>');
    expect(renderRichHtml('{xl}**fett groß**{/xl} und {s}klein{/s}'))
      .toBe('<p><span class="rt-xl"><strong>fett groß</strong></span> und <span class="rt-s">klein</span></p>');
    expect(richToPlain('Ein {l}großes{/l} Wort')).toBe('Ein großes Wort');
  });

  it('falsch geschlossen oder unbekannte Größe bleibt Text; nie freies HTML', () => {
    expect(renderRichHtml('{l}a{/xl}')).toBe('<p>{l}a{/xl}</p>');
    expect(renderRichHtml('{m}a{/m}')).toBe('<p>{m}a{/m}</p>');
    expect(renderRichHtml('{l}<b>x</b>{/l}')).toBe('<p><span class="rt-l">&lt;b&gt;x&lt;/b&gt;</span></p>');
  });

  it('dieselbe Darstellung im DOM (Laufzeit, CMS-Vorschau)', () => {
    const box = document.createElement('div');
    renderRichInto(box, 'a {xl}b{/xl}');
    expect(box.innerHTML).toBe('<p>a <span class="rt-xl">b</span></p>');
  });

  it('site.css kennt alle Größen', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/site/site.css'), 'utf8');
    for (const s of ['s', 'l', 'xl']) expect(css, s).toContain(`.rt-${s} { font-size:`);
  });
});

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
    expect(createHash('sha256').update(src).digest('hex')).toBe('2b8ffa45b56ac52045511a4603fc4d8fdf88aa52528bde0bb29d192ea20ea15b');
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

describe('Feature: jeder Fließtext in einer Kachel ist formatierbar (Werkzeugleiste im CMS)', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const pages = ['pages/lunar-habitato/index.html', 'pages/dual-use/index.html', 'pages/people/index.html'];

  it('Founder-Absätze und Kacheltexte sind formatierbar, Überschriften und Listenzeilen nicht', () => {
    expect(isRichKey('people.profile.p1')).toBe(true);
    expect(isRichKey('people.profile.p12')).toBe(true);
    expect(isRichKey('people.profile.name')).toBe(false);
    expect(isRichKey('people.profile.contact')).toBe(false);
    expect(isRichKey('people.books.1.meta')).toBe(false);
  });

  for (const page of pages) {
    it(`${page}: kein Absatz (<p data-i18n>) in einem aufklappbaren Bereich ohne Formatierung`, () => {
      const html = readFileSync(resolve(root, page), 'utf8');
      const panels = [...html.matchAll(/<div class="band-panel"[\s\S]*?(?=<div class="band-group"|<!-- \/cms:bands -->|<\/section>)/g)].map((m) => m[0]);
      expect(panels.length).toBeGreaterThan(0);
      for (const panel of panels) {
        // Absätze: <p data-i18n> (ohne die Zwischenüberschrift „eyebrow“) müssten formatierbare Texte sein
        for (const m of panel.matchAll(/<p(?![^>]*class="eyebrow")[^>]*\sdata-i18n="([^"]+)"/g)) {
          expect(isRichKey(m[1]), `${m[1]} ist ein Absatz ohne Werkzeugleiste`).toBe(true);
        }
        // Jedes Textfeld (panel-text) ist formatiert und steht als <div> (Absätze und Listen darin)
        for (const m of panel.matchAll(/<([a-z]+) class="panel-text" data-i18n="([^"]+)"/g)) {
          expect(isRichKey(m[2]), m[2]).toBe(true);
          expect(m[1], `${m[2]} muss ein <div> sein`).toBe('div');
        }
      }
    });
  }
});

describe('Feature: Hauptüberschrift der Startseite formatierbar (Inhaber 23.11.2026)', () => {
  it('nur Inline-Formate: Zeilen als <br>, keine Absätze und Listen — ein <p> darf nicht ins <h1>', async () => {
    const { isInlineRichKey } = await import('../../src/site/i18n/rich-text.js');
    expect(isInlineRichKey('home.hero.lead1') && isRichKey('home.hero.lead1')).toBe(true);
    const html = renderRichHtml('New Space Economy for\nLunar {l}Infrastructure{/l}\n\n**WE ORCHESTRATE**\n- kein Punkt', { inline: true });
    expect(html).toBe('New Space Economy for<br>Lunar <span class="rt-l">Infrastructure</span><br><br><strong>WE ORCHESTRATE</strong><br>- kein Punkt');
    expect(html).not.toMatch(/<(p|ul|li|div)\b/);
  });

  it('beim Übernehmen landet die Überschrift formatiert im <h1>, ohne <p>', async () => {
    const { setElementText } = await import('../../scripts/lib/apply.mjs');
    const r = setElementText('<h1 data-i18n="home.hero.lead1">Alt</h1>', 'home.hero.lead1', 'A\n**B** {xl}C{/xl}');
    expect(r.html).toBe('<h1 data-i18n="home.hero.lead1">A<br><strong>B</strong> <span class="rt-xl">C</span></h1>');
  });
});
