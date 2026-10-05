/**
 * Feature: Kacheln aus dem CMS (scripts/lib/bands.mjs) — hinzufügen, löschen,
 * verschieben, Bild tauschen, ohne bestehendes Markup zu verändern.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  splitRegion, parseBands, applyBands, renderBand, maskRegion,
  insertDictKeys, removeDictKey, dictEscape, prefixOf, mediaClass, ZOOM,
} from '../../scripts/lib/bands.mjs';
import { listImages, setImages } from '../../scripts/lib/apply.mjs';

const ROOT = join(import.meta.dirname, '../..');
const page = (slug) => readFileSync(join(ROOT, `pages/${slug}/index.html`), 'utf8');
// Feste Vorlagen (Stand 29.09.2026): die echten Seiten ändert künftig das CMS —
// Tests auf konkrete Kacheln dürfen das Veröffentlichen nicht blockieren.
const fixture = (name) => readFileSync(join(ROOT, `tests/fixtures/${name}`), 'utf8');
const asData = (bands) => bands.map(({ id, titleKey, textKey, image }) => ({ id, titleKey, textKey, image: { ...image } }));

describe('Feature: Kacheln aus dem CMS', () => {
  const html = fixture('bands-lunar.html');
  const bands = asData(parseBands(splitRegion(html).region));
  const ids = (h) => parseBands(splitRegion(h).region).map((b) => b.id);

  it('erkennt die verwalteten Kacheln', () => {
    expect(ids(html)).toEqual(['space', 'design', 'research', 'history', 'partnership']);
    expect(ids(fixture('bands-people.html'))).toEqual(['team']); // Founder mit Porträt bleibt Code
  });

  it('jede echte Kachel-Seite hat einen sauber lesbaren Bereich (unabhängig vom Inhalt)', () => {
    for (const slug of ['lunar-habitato', 'dual-use', 'people']) {
      const bands = parseBands(splitRegion(page(slug)).region);
      const found = bands.map((b) => b.id);
      expect(new Set(found).size, `${slug}: doppelte Kachel-IDs`).toBe(found.length);
      for (const b of bands) {
        expect(b.titleKey, slug).toMatch(/^[a-z][a-z0-9-]*\.band\.[a-z0-9-]+$/);
        expect(b.textKey, slug).toBe(`${b.titleKey.split('.')[0]}.panel.${b.id}.text`);
        // Bild oder bewusst keins (Kachel ohne Bild, band--plain) — nie ein kaputter Pfad
        if (b.image.src !== undefined) expect(b.image.src, slug).toMatch(/^\/Bilder\//);
        else expect(b.block, slug).toContain('band--plain');
      }
    }
  });

  it('lässt jede Seite unverändert, wenn das CMS nichts geändert hat', () => {
    for (const slug of ['lunar-habitato', 'dual-use', 'people']) {
      const h = page(slug);
      const r = applyBands(h, asData(parseBands(splitRegion(h).region)));
      expect(r.changed, slug).toBe(false);
      expect(r.html).toBe(h);
    }
  });

  it('verschiebt Kacheln samt ihrem Markup und hält genau eine h1 vorne', () => {
    const moved = [bands[1], bands[0], ...bands.slice(2)];
    const r = applyBands(html, moved);
    expect(ids(r.html)).toEqual(['design', 'space', 'research', 'history', 'partnership']);
    expect([...r.html.matchAll(/<h1\b/g)]).toHaveLength(1);
    expect(r.html).toMatch(/<h1 class="band-h" data-i18n="habitat.band.design">/);
    expect(r.html).toMatch(/<h2 class="band-h" data-i18n="habitat.band.space">/);
    // Besonderheiten bleiben erhalten: Hochformat fürs Handy, Zusatzklasse
    expect(r.html).toContain('srcset="/Bilder/2026-09-Partner-logos-hoch.jpg"');
    expect(r.html).toContain('band-media--partnership');
  });

  it('legt eine neue Kachel aus der Vorlage an und entfernt gelöschte', () => {
    const neu = { id: 'roehren', titleKey: 'habitat.band.roehren', textKey: 'habitat.panel.roehren.text', image: { src: '/Bilder/cms/roehre.jpg', focus: 'top' } };
    const text = (k) => ({ 'habitat.band.roehren': 'Röhren & Tunnel', 'habitat.panel.roehren.text': 'Absatz eins.\n\nAbsatz zwei.' })[k];
    const r = applyBands(html, [...bands.filter((b) => b.id !== 'history'), neu], text);
    expect(r.added).toEqual(['roehren']);
    expect(r.removed).toEqual(['history']);
    expect(ids(r.html)).toEqual(['space', 'design', 'research', 'partnership', 'roehren']);
    expect(r.html).toContain('<img class="band-media band-media--top" src="/Bilder/cms/roehre.jpg" alt="" loading="lazy">');
    expect(r.html).toContain('<h2 class="band-h" data-i18n="habitat.band.roehren">Röhren &amp; Tunnel</h2>');
    expect(r.html).toContain('aria-controls="band-roehren" data-i18n="common.more">Learn more</button>');
    expect(r.html).toContain('<div class="band-panel" id="band-roehren" hidden>');
    // Kacheltexte sind formatiert (rich-text.js): <div> mit echten Absätzen
    expect(r.html).toContain('<div class="panel-text" data-i18n="habitat.panel.roehren.text"><p>Absatz eins.</p><p>Absatz zwei.</p></div>');
    expect(r.html).not.toContain('band-history');
  });

  it('tauscht ein Bild; aus <picture> wird ein schlichtes <img>, der Ausschnitt ist wählbar', () => {
    const swapped = bands.map((b) => (b.id === 'research' ? { ...b, image: { src: '/Bilder/cms/neu.jpg', focus: 'bottom' } } : b));
    const r = applyBands(html, swapped);
    expect(r.html).not.toContain('Partner-logos-hoch');
    expect(r.html).toContain('<img class="band-media band-media--bottom" src="/Bilder/cms/neu.jpg" alt="" loading="lazy">');
    // ohne Ausschnitt-Angabe bleibt die vorhandene Klasse
    const keep = applyBands(html, bands.map((b) => (b.id === 'partnership' ? { ...b, image: { src: '/Bilder/cms/x.jpg' } } : b)));
    expect(keep.html).toContain('<img class="band-media band-media--partnership" src="/Bilder/cms/x.jpg"');
  });

  it('gibt die h1 nicht ab, wenn die Seite davor schon eine hat (People: Founder)', () => {
    const h = fixture('bands-people.html');
    const team = asData(parseBands(splitRegion(h).region));
    const neu = { id: 'network', titleKey: 'people.band.network', textKey: 'people.panel.network.text', image: { src: '/Bilder/cms/n.jpg' } };
    const r = applyBands(h, [neu, ...team], () => 'x');
    expect([...r.html.matchAll(/<h1\b/g)]).toHaveLength(1);
    expect(r.html).toContain('<h2 class="band-h" data-i18n="people.band.network">');
  });

  it('meldet eine Seite ohne Bereich statt sie anzufassen', () => {
    const h = page('contact');
    const r = applyBands(h, []);
    expect(r.html).toBe(h);
    expect(r.skipped).toMatch(/kein Bereich/);
  });

  it('entfernt auf Wunsch alle Kacheln, die Marker bleiben stehen', () => {
    const r = applyBands(html, []);
    expect(ids(r.html)).toEqual([]);
    expect(r.html).toContain('<!-- cms:bands -->');
    expect(r.html).toContain('<!-- /cms:bands -->');
  });

  it('Kachel-Bilder zählen nicht bei der Bildzuordnung nach Position mit', () => {
    const h = fixture('bands-people.html');
    const { masked, restore } = maskRegion(h);
    const outside = listImages(masked);
    expect(outside).not.toContain('/Bilder/2026-09-Habitat-living.jpg'); // Team-Kachel
    const r = setImages(masked, outside.map((src) => ({ src })));
    expect(restore(r.html)).toBe(h);
  });

  it('renderBand erzeugt denselben Aufbau wie die bestehenden Kacheln', () => {
    const block = renderBand({ id: 'x', titleKey: 'p.band.x', textKey: 'p.panel.x.text', title: 'T', text: 'U', image: { src: '/Bilder/a.jpg' } });
    expect(block.split('\n')).toHaveLength(12);
    expect(parseBands(`${block}\n`)[0]).toMatchObject({ id: 'x', titleKey: 'p.band.x', textKey: 'p.panel.x.text', image: { src: '/Bilder/a.jpg' } });
  });
});

describe('Feature: Wörterbuch-Schlüssel für Kacheln', () => {
  const dict = () => [
    'export const EN = {',
    "  'habitat.band.space':     'New Space Economy',",
    "  'habitat.panel.space.text': 'A\\n\\nB',",
    "  'dual.band.defense':      'Defense',",
    '};',
  ];

  it('fügt neue Schlüssel hinter dem letzten gleichen Präfix ein und maskiert Umbrüche', () => {
    const lines = dict();
    const n = insertDictKeys(lines, [
      { key: 'habitat.band.roehren', value: "Röhren's" },
      { key: 'habitat.panel.roehren.text', value: 'Eins.\n\nZwei.' },
    ], 'habitat.');
    expect(n).toBe(2);
    expect(lines[3]).toBe("  'habitat.band.roehren': 'Röhren\\'s',");
    expect(lines[4]).toBe("  'habitat.panel.roehren.text': 'Eins.\\n\\nZwei.',");
    expect(lines[5]).toBe("  'dual.band.defense':      'Defense',");
  });

  it('legt vorhandene Schlüssel nicht doppelt an und entfernt gezielt', () => {
    const lines = dict();
    expect(insertDictKeys(lines, [{ key: 'habitat.band.space', value: 'x' }], 'habitat.')).toBe(0);
    expect(removeDictKey(lines, 'habitat.panel.space.text')).toBe(true);
    expect(removeDictKey(lines, 'gibt.es.nicht')).toBe(false);
    expect(lines).toHaveLength(4);
  });

  it('Hilfsfunktionen', () => {
    expect(dictEscape("a'b\\c\r\nd")).toBe("a\\'b\\\\c\\nd");
    expect(prefixOf('people.band.team')).toBe('people');
  });
});

describe('Feature: Kacheln ohne Bild', () => {
  const html = fixture('bands-lunar.html');
  const bands = asData(parseBands(splitRegion(html).region));
  const blockOf = (h, id) => parseBands(splitRegion(h).region).find((b) => b.id === id).block;

  it('neue Kachel ohne Bild: dunkle Fläche (band--plain), kein <img>, Titel und Knopf wie sonst', () => {
    const neu = { id: 'ohne', titleKey: 'habitat.band.ohne', textKey: 'habitat.panel.ohne.text', image: { src: null } };
    const r = applyBands(html, [...bands, neu], (k) => ({ 'habitat.band.ohne': 'Ohne Bild', 'habitat.panel.ohne.text': 'Text' })[k]);
    const block = blockOf(r.html, 'ohne');
    expect(block).toContain('<div class="band band--plain">');
    expect(block).not.toContain('<img');
    expect(block).toContain('data-i18n="habitat.band.ohne">Ohne Bild</h2>');
    expect(block).toContain('aria-controls="band-ohne"');
  });

  it('bestehende Kachel: Bild entfernen und wieder einsetzen, sonst bleibt alles gleich', () => {
    const without = applyBands(html, bands.map((b) => (b.id === 'design' ? { ...b, image: { src: null } } : b)));
    const plain = blockOf(without.html, 'design');
    expect(plain).toContain('band--plain');
    expect(plain).not.toMatch(/<img|<picture/);
    expect(applyBands(without.html, asData(parseBands(splitRegion(without.html).region))).changed).toBe(false);

    const back = applyBands(without.html, bands.map((b) => (b.id === 'design' ? { ...b, image: { src: '/Bilder/cms/neu.jpg', focus: 'top' } } : b)));
    const withImg = blockOf(back.html, 'design');
    expect(withImg).not.toContain('band--plain');
    expect(withImg).toMatch(/<img class="band-media band-media--top" src="\/Bilder\/cms\/neu\.jpg"/);
    // das Bild steht vor der Titelzeile, wie bei allen Kacheln
    expect(withImg.indexOf('<img')).toBeLessThan(withImg.indexOf('band-title'));
  });

  it('fehlt die Bildangabe ganz (undefined), bleibt das vorhandene Bild', () => {
    const r = applyBands(html, bands.map((b) => (b.id === 'design' ? { ...b, image: undefined } : b)));
    expect(r.changed).toBe(false);
  });
});

describe('Feature: Ausschnitt (3×3) und Zoom aus dem CMS', () => {
  const html = fixture('bands-lunar.html');
  const bands = asData(parseBands(splitRegion(html).region));
  const blockOf = (h, id) => parseBands(splitRegion(h).region).find((b) => b.id === id).block;
  const css = readFileSync(join(ROOT, 'src/site/site.css'), 'utf8');

  it('Klassen aus senkrecht, waagrecht und Zoom — ungültiger Zoom wird ignoriert', () => {
    expect(mediaClass({})).toBe('band-media');
    expect(mediaClass({ focus: 'top', focusX: 'right', zoom: 150 })).toBe('band-media band-media--top band-media--right band-media--z150');
    expect(mediaClass({ focus: 'center', focusX: 'center', zoom: 100 })).toBe('band-media');
    for (const z of [95, 255, 133, '150', null]) expect(mediaClass({ zoom: z }), String(z)).toBe('band-media');
  });

  it('site.css hat für jede Zoomstufe und jede Richtung eine Regel', () => {
    for (let z = ZOOM.min; z <= ZOOM.max; z += ZOOM.step) {
      if (z !== ZOOM.neutral) expect(css, `z${z}`).toContain(`.band-media--z${z} { --z: ${z / 100}; }`);
    }
    expect(mediaClass({ zoom: 60 })).toBe('band-media'); // nie kleiner als eingepasst
    expect(css).not.toContain('.band-media--z90');
    for (const c of ['top', 'bottom', 'left', 'right']) expect(css).toContain(`.band-media--${c} {`);
    expect(css).toContain('.band-media[class*="band-media--z"] { transform: scale(var(--z)); transform-origin: var(--fx) var(--fy); }');
  });

  it('bestehende Kachel: gewählter Ausschnitt ersetzt die Klasse, „Mitte, 100 %“ setzt zurück', () => {
    const zoomed = applyBands(html, bands.map((b) => (b.id === 'design' ? { ...b, image: { ...b.image, focus: 'bottom', focusX: 'left', zoom: 180 } } : b)));
    expect(blockOf(zoomed.html, 'design')).toContain('class="band-media band-media--bottom band-media--left band-media--z180"');
    const back = applyBands(zoomed.html, bands.map((b) => (b.id === 'design' ? { ...b, image: { ...b.image, focus: 'center', focusX: 'center', zoom: 100 } } : b)));
    expect(blockOf(back.html, 'design')).toMatch(/<img class="band-media" src=/);
  });

  it('ohne Wahl im CMS bleibt eine eigene Klasse (etwa band-media--partnership) stehen', () => {
    const own = html.replace(/<img class="band-media[^"]*"/, '<img class="band-media band-media--partnership"');
    const first = parseBands(splitRegion(own).region)[0];
    const r = applyBands(own, asData(parseBands(splitRegion(own).region)).map((b) => (b.id === first.id ? { ...b, image: { src: b.image.src } } : b)));
    expect(blockOf(r.html, first.id)).toContain('band-media--partnership');
  });
});

describe('Feature: Alt-Text der Kachelbilder aus dem CMS', () => {
  const html = fixture('bands-lunar.html');
  const bands = asData(parseBands(splitRegion(html).region));
  const blockOf = (h, id) => parseBands(splitRegion(h).region).find((b) => b.id === id).block;

  it('setzt, ändert und leert den Alt-Text (maskiert), Bild und Klasse bleiben', () => {
    const r = applyBands(html, bands.map((b) => (b.id === 'design' ? { ...b, image: { ...b.image, alt: 'Habitat "Matryoshka" & more' } } : b)));
    const block = blockOf(r.html, 'design');
    expect(block).toContain('alt="Habitat &quot;Matryoshka&quot; &amp; more" loading="lazy">');
    expect(parseBands(splitRegion(r.html).region).find((b) => b.id === 'design').image.alt).toBe('Habitat "Matryoshka" & more');
    const cleared = applyBands(r.html, asData(parseBands(splitRegion(r.html).region)).map((b) => (b.id === 'design' ? { ...b, image: { ...b.image, alt: '' } } : b)));
    expect(blockOf(cleared.html, 'design')).toContain('alt="" loading="lazy">');
  });

  it('ohne Angabe (ältere Datenbank) bleibt der vorhandene Alt-Text; zweimal anwenden ändert nichts', () => {
    const withAlt = applyBands(html, bands.map((b) => (b.id === 'design' ? { ...b, image: { ...b.image, alt: 'X' } } : b))).html;
    const again = applyBands(withAlt, asData(parseBands(splitRegion(withAlt).region)).map((b) => ({ ...b, image: { src: b.image.src } })));
    expect(blockOf(again.html, 'design')).toContain('alt="X"');
    expect(applyBands(withAlt, asData(parseBands(splitRegion(withAlt).region))).changed).toBe(false);
  });

  it('neue Kachel mit Alt-Text', () => {
    const neu = { id: 'neu', titleKey: 'habitat.band.neu', textKey: 'habitat.panel.neu.text', image: { src: '/Bilder/cms/n.webp', alt: 'Neues Motiv' } };
    expect(blockOf(applyBands(html, [...bands, neu], () => 'T').html, 'neu')).toContain('src="/Bilder/cms/n.webp" alt="Neues Motiv" loading="lazy">');
  });
});

