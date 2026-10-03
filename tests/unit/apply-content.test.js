/**
 * Feature: CMS-Export zurück in die Website (scripts/lib/apply.mjs)
 *
 * Sichert die Stellen, an denen ein Generator still Schaden anrichtet:
 *  - ein Schlüssel steht mehrfach in einer Seite (Titel + og:title, „Learn more“)
 *  - Galerie-Bilder brauchen src UND href (sonst zeigt die Lightbox das alte Bild)
 *  - Sonderzeichen müssen im HTML und im Wörterbuch richtig entkommen
 *  - zweimal anwenden darf nichts mehr ändern
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  setDictValue, hasDictKey, setElementText, setElementAttr,
  setImages, listImages, applyKeyToHtml, sharedKeys, applyKeysToHtml, setRows, moonClass,
} from '../../scripts/lib/apply.mjs';

describe('Feature: Wörterbuch-Werte ersetzen', () => {
  it('ersetzt den Wert und lässt Einrückung und Schlüssel stehen', () => {
    const lines = ["  'nav.contact':    'Contact',"];
    expect(setDictValue(lines, 'nav.contact', 'Get in touch')).toBe(true);
    expect(lines[0]).toBe("  'nav.contact':    'Get in touch',");
  });

  it('maskiert Zeilenumbrüche (Absätze in Kachel-Texten) statt die Zeile zu zerbrechen', () => {
    const lines = ["  'a.text': 'x',", "  'b': 'y',"];
    setDictValue(lines, 'a.text', 'Absatz eins.\n\nAbsatz zwei.\r\nDrei.');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("  'a.text': 'Absatz eins.\\n\\nAbsatz zwei.\\nDrei.',");
    // und bleibt beim nächsten Durchlauf ersetzbar
    expect(setDictValue(lines, 'a.text', 'neu')).toBe(true);
    expect(lines[0]).toBe("  'a.text': 'neu',");
  });

  it('entkommt Apostroph und Backslash', () => {
    const lines = ["  'a.b': 'x',"];
    setDictValue(lines, 'a.b', "Let's go \\ home");
    expect(lines[0]).toBe("  'a.b': 'Let\\'s go \\\\ home',");
  });

  it('ersetzt auch einen Wert, der bereits einen entkommenen Apostroph enthält', () => {
    const lines = ["  'a.b': 'Let\\'s go',"];
    expect(setDictValue(lines, 'a.b', 'Plain')).toBe(true);
    expect(lines[0]).toBe("  'a.b': 'Plain',");
  });

  it('meldet false bei gleichem Wert und bei unbekanntem Schlüssel', () => {
    const lines = ["  'a.b': 'x',"];
    expect(setDictValue(lines, 'a.b', 'x')).toBe(false);
    expect(setDictValue(lines, 'gibt.es.nicht', 'y')).toBe(false);
    expect(hasDictKey(lines, 'a.b')).toBe(true);
    expect(hasDictKey(lines, 'gibt.es.nicht')).toBe(false);
  });
});

describe('Feature: Texte in der Seite ersetzen', () => {
  it('ersetzt JEDE Fundstelle desselben Schlüssels', () => {
    const html = '<span data-i18n="common.more">Learn more</span><b/>'
      + '<span data-i18n="common.more">Learn more</span>';
    const r = setElementText(html, 'common.more', 'Read on');
    expect(r.changed).toBe(true);
    expect([...r.html.matchAll(/Read on/g)]).toHaveLength(2);
    expect(r.html).not.toContain('Learn more');
  });

  it('entkommt spitze Klammern und kaufmännisches Und', () => {
    const { html } = setElementText('<h2 data-i18n="k">x</h2>', 'k', 'Design & IP <neu>');
    expect(html).toBe('<h2 data-i18n="k">Design &amp; IP &lt;neu&gt;</h2>');
  });

  it('lässt Dollarzeichen im Text unangetastet (kein Regex-Ersatzmuster)', () => {
    const { html } = setElementText('<p data-i18n="k">x</p>', 'k', 'Kosten: $1 statt $&');
    expect(html).toBe('<p data-i18n="k">Kosten: $1 statt $&amp;</p>');
  });

  it('meldet keine Änderung, wenn der Text schon stimmt', () => {
    expect(setElementText('<p data-i18n="k">gleich</p>', 'k', 'gleich').changed).toBe(false);
  });
});

describe('Feature: Attribute ersetzen', () => {
  const head = '<title data-i18n="m.t">Alt</title>'
    + '<meta name="description" data-i18n-content="m.d" content="Alt">'
    + '<meta property="og:description" data-i18n-content="m.d" content="Alt">';

  it('fasst beide Beschreibungen an (name=… und og:…)', () => {
    const r = setElementAttr(head, 'm.d', 'Neu', 'content', 'content');
    expect(r.changed).toBe(true);
    expect([...r.html.matchAll(/content="Neu"/g)]).toHaveLength(2);
    expect(r.html).not.toContain('content="Alt"');
  });

  it('entkommt Anführungszeichen im Attributwert', () => {
    const { html } = setElementAttr('<meta data-i18n-content="k" content="x">', 'k', 'Sie sagte "ja"', 'content', 'content');
    expect(html).toContain('content="Sie sagte &quot;ja&quot;"');
  });

  it('applyKeyToHtml erledigt Text und Attribute in einem Zug', () => {
    const r = applyKeyToHtml(head, 'm.t', 'Titel neu');
    expect(r.html).toContain('<title data-i18n="m.t">Titel neu</title>');
    expect(r.changed).toBeGreaterThan(0);
  });
});

describe('Feature: Bildpfade ersetzen', () => {
  const gallery = '<figure><a class="gallery-item" href="/Bilder/alt.jpg" data-lightbox>'
    + '<img src="/Bilder/alt.jpg" alt=""></a></figure>';

  it('zieht bei Galerie-Bildern href und src gemeinsam um', () => {
    const r = setImages(gallery, [{ src: '/Bilder/neu.jpg' }]);
    expect(r.changed).toBe(1);
    expect(r.html).toContain('href="/Bilder/neu.jpg" data-lightbox');
    expect(r.html).toContain('src="/Bilder/neu.jpg"');
    expect(r.html).not.toContain('alt.jpg');
  });

  it('erfasst auch den Portrait-Platzhalter', () => {
    const html = '<div class="portrait" data-portrait-src="/Bilder/p.jpg"></div>';
    expect(listImages(html)).toEqual(['/Bilder/p.jpg']);
    const r = setImages(html, [{ src: '/Bilder/q.jpg' }]);
    expect(r.html).toContain('data-portrait-src="/Bilder/q.jpg"');
  });

  it('rührt die Seite nicht an, wenn die Anzahl nicht passt', () => {
    const html = '<img src="/Bilder/a.jpg"><img src="/Bilder/b.jpg">';
    const r = setImages(html, [{ src: '/Bilder/c.jpg' }]);
    expect(r.html).toBe(html);
    expect(r.changed).toBe(0);
    expect(r.skipped).toMatch(/2 Bilder in der Seite, 1 im Export/);
  });

  it('übergeht Pfade außerhalb von /Bilder/', () => {
    const html = '<img src="/Bilder/a.jpg">';
    const r = setImages(html, [{ src: 'https://fremd.example/x.jpg' }]);
    expect(r.html).toBe(html);
    expect(r.changed).toBe(0);
  });
});

describe('Feature: Header- und Footer-Texte kommen in jede Seite', () => {
  const pages = [
    { slug: 'index', keys: [{ key: 'home.hero.title', en: 'Hero' }] },
    { slug: 'global', keys: [{ key: 'footer.project', en: 'A project by Dr. Dr. Johannes Lierfeld' }] },
  ];

  const enOf = (key) => [...pages.flatMap((p) => p.keys)].find((k) => k.key === key)?.en;

  it('die geteilten Schlüssel sind die der Seite „global“ — auch in einem Export nur mit „global“', () => {
    expect(sharedKeys(pages).map((k) => k.key)).toEqual(['footer.project']);
    expect(sharedKeys([pages[1]]).map((k) => k.key)).toEqual(['footer.project']);
    expect(sharedKeys([pages[0]])).toEqual([]);
  });

  it('der geänderte Footer-Text landet im HTML der Seite, auch als Attribut', () => {
    const html = '<nav aria-label="Main" data-i18n-aria-label="nav.main"></nav>'
      + '<footer><span data-i18n="footer.project">A project by Dr. Johannes Lierfeld</span></footer>';
    const keys = [...sharedKeys(pages), { key: 'nav.main' }];
    const r = applyKeysToHtml(html, keys, (key) => (key === 'nav.main' ? 'Primary navigation' : enOf(key)));
    expect(r.html).toContain('>A project by Dr. Dr. Johannes Lierfeld</span>');
    expect(r.html).toContain('aria-label="Primary navigation"');
    expect(r.changed).toBe(2);
  });

  it('nur per JavaScript genutzte Schlüssel ändern nichts und sind kein Fehler', () => {
    const r = applyKeysToHtml('<p>x</p>', [{ key: 'chat.placeholder' }], () => 'Ask me');
    expect(r).toEqual({ html: '<p>x</p>', changed: 0 });
  });
});

describe('Feature: zweimal anwenden ändert nichts mehr', () => {
  it('Text, Attribut und Bild sind nach dem ersten Lauf stabil', () => {
    const html = '<title data-i18n="k">Alt</title>'
      + '<meta data-i18n-content="k" content="Alt">'
      + '<a href="/Bilder/alt.jpg" data-lightbox><img src="/Bilder/alt.jpg"></a>';
    const once = setImages(applyKeyToHtml(html, 'k', 'Neu').html, [{ src: '/Bilder/neu.jpg' }]).html;
    const twice = setImages(applyKeyToHtml(once, 'k', 'Neu').html, [{ src: '/Bilder/neu.jpg' }]);
    expect(twice.html).toBe(once);
    expect(twice.changed).toBe(0);
  });
});

describe('Feature: Dollarzeichen im Text bleiben, wie sie sind', () => {
  // In einem Ersetzungs-TEXT sind $1, $&, $$, $` und $' Platzhalter. „$1M per
  // kilogram“ im Kacheltext verfälschte so am 30.09.2026 das Wörterbuch (i18n.test
  // hielt das Veröffentlichen an). Alle Ersetzungen mit CMS-Inhalt laufen deshalb
  // über Funktionen.
  const DOLLAR = "Cost of $1M per kg, $& and $$ and $` and $' end, 1M $ / kg, zuletzt $";

  it('Wörterbuch', async () => {
    const lines = ["export const EN = {", "  'habitat.panel.space.text': 'alt',", '};'];
    expect(setDictValue(lines, 'habitat.panel.space.text', DOLLAR)).toBe(true);
    const EN = new Function(`${lines.join('\n').replace('export const EN =', 'return')}`)();
    expect(EN['habitat.panel.space.text']).toBe(DOLLAR);
  });

  it('Attribut (Meta-Beschreibung)', () => {
    const html = '<meta name="description" content="alt" data-i18n-content="x.meta.description">';
    const { html: out } = setElementAttr(html, 'x.meta.description', DOLLAR, 'content', 'content');
    const doc = new DOMParser().parseFromString(out, 'text/html');
    expect(doc.querySelector('meta').getAttribute('content')).toBe(DOLLAR);
  });

  it('Kacheltext im verwalteten Bereich übersteht Maskieren und Zurücksetzen', async () => {
    const { maskRegion } = await import('../../scripts/lib/bands.mjs');
    const html = `<main>\n<!-- cms:bands -->\n<div class="panel-text" data-i18n="a.panel.x.text"><p>${DOLLAR}</p></div>\n<!-- /cms:bands -->\n</main>`;
    const { masked, restore } = maskRegion(html);
    expect(restore(masked)).toBe(html);
  });

  it('Bildpfad', () => {
    const html = '<img src="/Bilder/alt.jpg" alt="">';
    const { html: out } = setImages(html, [{ src: '/Bilder/$1-$&.jpg', alt: '' }]);
    expect(out).toContain('src="/Bilder/$1-$&.jpg"');
  });
});

describe('Feature: Bilder im CMS entfernen und wieder einsetzen', () => {
  const html = '<div class="hero"><img src="/Bilder/a.jpg" alt="" class="bg"></div>'
    + '<div class="portrait" data-portrait-src="/Bilder/p.jpg" data-portrait-alt="P"></div><img src="/Bilder/p.jpg" alt="P">';

  it('entfernt = Attribut hidden am Element dieser Position, Reihenfolge bleibt', () => {
    const r = setImages(html, [{ src: '/Bilder/a.jpg', alt: '', hidden: true }, { src: '/Bilder/p.jpg' }, { src: '/Bilder/p.jpg' }]);
    const doc = new DOMParser().parseFromString(r.html, 'text/html');
    expect(doc.querySelector('.bg').hidden).toBe(true);
    expect(doc.querySelector('.portrait').hidden).toBe(false);
    expect(listImages(r.html)).toEqual(listImages(html)); // Zuordnung bleibt
    expect(r.changed).toBe(1);
    // zweimal anwenden ändert nichts mehr
    expect(setImages(r.html, [{ src: '/Bilder/a.jpg', hidden: true }, { src: '/Bilder/p.jpg' }, { src: '/Bilder/p.jpg' }]).changed).toBe(0);
    // wieder einsetzen
    const back = setImages(r.html, [{ src: '/Bilder/neu.jpg' }, { src: '/Bilder/p.jpg' }, { src: '/Bilder/p.jpg' }]);
    const doc2 = new DOMParser().parseFromString(back.html, 'text/html');
    expect(doc2.querySelector('.bg').hidden).toBe(false);
    expect(doc2.querySelector('.bg').getAttribute('src')).toBe('/Bilder/neu.jpg');
  });

  it('dasselbe Bild zweimal: Tausch und Entfernen treffen genau die Position', () => {
    const r = setImages(html, [{ src: '/Bilder/a.jpg' }, { src: '/Bilder/p.jpg' }, { src: '/Bilder/q.jpg', hidden: true }]);
    const doc = new DOMParser().parseFromString(r.html, 'text/html');
    expect(doc.querySelector('.portrait').getAttribute('data-portrait-src')).toBe('/Bilder/p.jpg');
    expect(doc.querySelector('.portrait').hidden).toBe(false);
    const last = doc.querySelectorAll('img')[1];
    expect(last.getAttribute('src')).toBe('/Bilder/q.jpg');
    expect(last.hidden).toBe(true);
  });
});

describe('Feature: Alt-Texte aus dem CMS kommen an', () => {
  it('setzt alt am Bild und data-portrait-alt am Portrait, maskiert Anführungszeichen', () => {
    const html = '<img src="/Bilder/a.jpg" alt="alt"><div class="portrait" data-portrait-src="/Bilder/p.jpg" data-portrait-alt="P"></div><img src="/Bilder/b.jpg">';
    const r = setImages(html, [{ src: '/Bilder/a.jpg', alt: 'Neu "zitiert" & gut' }, { src: '/Bilder/p.jpg', alt: 'Dr. Dr. J. L.' }, { src: '/Bilder/b.jpg', alt: 'B' }]);
    const doc = new DOMParser().parseFromString(r.html, 'text/html');
    const imgs = doc.querySelectorAll('img');
    expect(imgs[0].getAttribute('alt')).toBe('Neu "zitiert" & gut');
    expect(doc.querySelector('.portrait').getAttribute('data-portrait-alt')).toBe('Dr. Dr. J. L.');
    expect(imgs[1].getAttribute('alt')).toBe('B'); // fehlte vorher, wird ergänzt
    expect(setImages(r.html, [{ src: '/Bilder/a.jpg', alt: 'Neu "zitiert" & gut' }, { src: '/Bilder/p.jpg', alt: 'Dr. Dr. J. L.' }, { src: '/Bilder/b.jpg', alt: 'B' }]).changed).toBe(0);
  });
});

describe('Feature: Zeilen im CMS entfernen (data-cms-row)', () => {
  const html = [
    '<ul class="books">',
    '<li data-cms-row="people.books.1.title"><a class="book" href="x"><span class="t" data-i18n="people.books.1.title">A</span></a></li>',
    '<li data-cms-row="people.books.2.title"><a class="book" href="y"><span class="t" data-i18n="people.books.2.title">B</span></a></li>',
    '</ul>',
  ].join('\n');

  it('hidden am Titel-Schlüssel blendet die ganze Zeile aus — das Element bleibt stehen', () => {
    const r = setRows(html, [{ key: 'people.books.1.title', hidden: true }, { key: 'people.books.2.title' }]);
    expect(r.changed).toBe(1);
    expect(r.html).toContain('<li data-cms-row="people.books.1.title" hidden><a class="book"');
    expect(r.html).toContain('<li data-cms-row="people.books.2.title"><a');
    expect(r.html).toContain('>A</span>'); // Text bleibt, nur ausgeblendet
  });

  it('wieder einblenden, zweimal anwenden ändert nichts, Schlüssel ohne Zeile werden ignoriert', () => {
    const hidden = setRows(html, [{ key: 'people.books.1.title', hidden: true }]).html;
    expect(setRows(hidden, [{ key: 'people.books.1.title', hidden: true }]).changed).toBe(0);
    const back = setRows(hidden, [{ key: 'people.books.1.title', hidden: false }]);
    expect(back.html).toBe(html);
    expect(setRows(html, [{ key: 'people.profile.p1', hidden: true }]).changed).toBe(0);
  });
});

describe('Feature: Mondbild der Startseite — Ausschnitt und Zoom aus dem CMS', () => {
  const html = '<div class="moon"><img class="moon-img" src="/Bilder/moon-full.jpg" alt="" decoding="async"></div>';
  const css = readFileSync(resolve(process.cwd(), 'src/site/site.css'), 'utf8');

  it('setzt die Klassen, „Mitte, 100 %“ setzt zurück, ohne Wahl bleibt alles', () => {
    const r = setImages(html, [{ src: '/Bilder/moon-full.jpg', alt: '', focus: 'top', focusX: 'left', zoom: 160 }]);
    expect(r.html).toContain('<img class="moon-img moon-img--top moon-img--left moon-img--z160" src="/Bilder/moon-full.jpg"');
    expect(setImages(r.html, [{ src: '/Bilder/moon-full.jpg', alt: '', focus: 'center', focusX: 'center', zoom: 100 }]).html).toBe(html);
    expect(setImages(html, [{ src: '/Bilder/moon-full.jpg', alt: '' }]).changed).toBe(0);
  });

  it('ungültiger Zoom zählt nicht; site.css hat jede Klasse', () => {
    expect(moonClass({ zoom: 333 })).toBe('moon-img');
    for (const c of moonClass({ focus: 'bottom', focusX: 'right', zoom: 250 }).split(' ').slice(1)) expect(css, c).toContain(`.moon .${c} {`);
    for (let z = 50; z <= 250; z += 10) if (z !== 100) expect(css).toContain(`.moon .moon-img--z${z} { --z: ${z / 100}; }`);
    expect(moonClass({ zoom: 70 })).toBe('moon-img moon-img--z70');
    expect(moonClass({ zoom: 100 })).toBe('moon-img');
  });
});

describe('Feature: Mondbild am PC höher zeigen (nur Desktop)', () => {
  const html = '<div class="moon"><img class="moon-img" src="/Bilder/x.jpg" alt="" decoding="async"></div>';
  const css = readFileSync(resolve(process.cwd(), 'src/site/site.css'), 'utf8');

  it('Klasse moon-img--up<n> (5–80, Fünfer), allein oder mit Zoom', () => {
    expect(setImages(html, [{ src: '/Bilder/x.jpg', alt: '', shiftY: 35 }]).html).toContain('class="moon-img moon-img--up35"');
    expect(moonClass({ zoom: 150, shiftY: 20 })).toBe('moon-img moon-img--z150 moon-img--up20');
    for (const v of [0, 3, 85, '20']) expect(moonClass({ shiftY: v })).toBe('moon-img');
  });

  it('wirkt nur ab 821 px Breite (Handy unverändert), jede Stufe hat eine Regel', () => {
    const desktop = css.slice(css.indexOf('@media (min-width: 821px) {'));
    for (let u = 5; u <= 80; u += 5) expect(desktop).toContain(`.moon .moon-img--up${u} { --up: ${u}%; }`);
    expect(css.slice(0, css.indexOf('@media (min-width: 821px) {'))).not.toContain('moon-img--up');
  });
});

