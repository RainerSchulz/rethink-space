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
import {
  setDictValue, hasDictKey, setElementText, setElementAttr,
  setImages, listImages, applyKeyToHtml,
} from '../../scripts/lib/apply.mjs';

describe('Feature: Wörterbuch-Werte ersetzen', () => {
  it('ersetzt den Wert und lässt Einrückung und Schlüssel stehen', () => {
    const lines = ["  'nav.contact':    'Contact',"];
    expect(setDictValue(lines, 'nav.contact', 'Get in touch')).toBe(true);
    expect(lines[0]).toBe("  'nav.contact':    'Get in touch',");
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
