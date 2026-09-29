/**
 * Feature: veröffentlichter Stand für das CMS (scripts/lib/snapshot.mjs) —
 * damit das CMS nur wirklich Geändertes als „noch nicht online“ markiert.
 */
import { describe, it, expect } from 'vitest';
import { toSnapshot } from '../../scripts/lib/snapshot.mjs';

const content = {
  pages: [
    {
      slug: 'lunar-habitato',
      keys: [
        { key: 'habitat.band.space', tag: 'h1', en: 'New Space Economy', de: 'NSE', position: 3 },
        { key: 'habitat.band.x', tag: 'h2', en: 'Übersprungen', de: '' },
      ],
      images: [{ src: '/Bilder/a.jpg', alt: 'A' }],
      bands: [{ id: 'space', titleKey: 'habitat.band.space', textKey: 'habitat.panel.space.text', image: { src: 'uploads/1-x.jpg', focus: 'top' } }],
    },
    { slug: 'global', keys: [{ key: 'nav.people', en: 'People', de: 'Menschen' }] },
  ],
};

describe('Feature: veröffentlichter Stand fürs CMS', () => {
  const snap = toSnapshot(content, (key) => key !== 'habitat.band.x');

  it('hält Texte mit Wert, Tag und Position fest — nur übernommene', () => {
    expect(snap.version).toBe(1);
    expect(snap.pages['lunar-habitato'].texts).toEqual({
      'habitat.band.space': { en: 'New Space Economy', de: 'NSE', tag: 'h1', position: 3 },
    });
    expect(snap.pages.global.texts['nav.people']).toEqual({ en: 'People', de: 'Menschen', tag: '', position: 0 });
  });

  it('behält Bildpfade so, wie das CMS sie kennt (Bucket, nicht /Bilder/cms)', () => {
    expect(snap.pages['lunar-habitato'].bands).toEqual([
      { id: 'space', titleKey: 'habitat.band.space', textKey: 'habitat.panel.space.text', src: 'uploads/1-x.jpg', focus: 'top' },
    ]);
    expect(snap.pages['lunar-habitato'].images).toEqual([{ src: '/Bilder/a.jpg', alt: 'A' }]);
    expect(snap.pages.global.bands).toEqual([]);
  });
});
