/**
 * Feature: Bilder aus der CMS-Medienbibliothek kommen auf die Website
 * (scripts/lib/cms-images.mjs). Bisher blieb ein hochgeladenes Bild beim
 * Übernehmen einfach weg.
 */
import { describe, it, expect, vi } from 'vitest';
import { resolveImage, localName, publicUrl } from '../../scripts/lib/cms-images.mjs';

const SB = 'https://abc.supabase.co';
function env({ have = [] } = {}) {
  const written = new Map();
  return {
    written,
    opts: {
      supabaseUrl: SB,
      dir: '/site/public/Bilder/cms',
      exists: (f) => have.includes(f) || written.has(f),
      write: (f, d) => written.set(f, d),
      fetchImpl: vi.fn(async () => ({ ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer })),
    },
  };
}

describe('Feature: Bilder aus dem CMS', () => {
  it('lässt eigene Website-Bilder unverändert', async () => {
    const { opts } = env();
    expect(await resolveImage('/Bilder/a.jpg', opts)).toEqual({ src: '/Bilder/a.jpg', downloaded: false });
    expect(opts.fetchImpl).not.toHaveBeenCalled();
  });

  it('lädt ein Bucket-Bild nach public/Bilder/cms und bindet es von dort ein', async () => {
    const { opts, written } = env();
    const r = await resolveImage('uploads/1790000000-Röhre Nord.JPG', opts);
    expect(r).toEqual({ src: '/Bilder/cms/1790000000-r-hre-nord.jpg', downloaded: true });
    expect(opts.fetchImpl).toHaveBeenCalledWith(`${SB}/storage/v1/object/public/media/uploads/1790000000-Röhre Nord.JPG`);
    expect([...written.keys()]).toEqual(['/site/public/Bilder/cms/1790000000-r-hre-nord.jpg']);
  });

  it('lädt nicht doppelt, wenn die Datei schon da ist (Übernehmen ist wiederholbar)', async () => {
    const { opts } = env({ have: ['/site/public/Bilder/cms/x.jpg'] });
    expect(await resolveImage('uploads/x.jpg', opts)).toEqual({ src: '/Bilder/cms/x.jpg', downloaded: false });
    expect(opts.fetchImpl).not.toHaveBeenCalled();
  });

  it('meldet Probleme, statt ein kaputtes Bild einzubinden', async () => {
    const { opts } = env();
    opts.fetchImpl = vi.fn(async () => ({ ok: false, status: 404 }));
    expect((await resolveImage('uploads/weg.jpg', opts)).src).toBeNull();
    expect((await resolveImage('uploads/x.jpg', { ...opts, supabaseUrl: '' })).note).toMatch(/SUPABASE_URL fehlt/);
    expect((await resolveImage('', opts)).src).toBeNull();
  });

  it('schreibt bei --dry nichts', async () => {
    const { opts, written } = env();
    const r = await resolveImage('uploads/y.png', { ...opts, dry: true });
    expect(r.src).toBe('/Bilder/cms/y.png');
    expect(written.size).toBe(0);
  });

  it('Hilfsfunktionen', () => {
    expect(localName('uploads/A B.JPG?x=1')).toBe('a-b.jpg');
    expect(publicUrl('https://cdn/x.jpg', SB)).toBe('https://cdn/x.jpg');
    expect(publicUrl('x.jpg', '')).toBeNull();
  });
});
