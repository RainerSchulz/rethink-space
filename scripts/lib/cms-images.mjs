/**
 * Bilder aus der CMS-Medienbibliothek (Supabase-Bucket „media“) in die Website holen.
 *
 * Das CMS speichert hochgeladene Bilder als Bucket-Pfad („uploads/…jpg“). Die
 * Website kennt aber nur eigene Dateien unter /Bilder/. Bisher blieb ein
 * getauschtes Bild deshalb einfach weg (setImages übersprang alles außerhalb
 * von /Bilder/). Jetzt wird es beim Übernehmen nach public/Bilder/cms/ geladen
 * und von dort eingebunden — content.yml committet es mit (git add -A).
 */

const OWN = /^\/Bilder\//;

/** Dateiname im Website-Ordner: nur harmlose Zeichen, Endung bleibt. */
export function localName(src) {
  const base = String(src).split(/[?#]/)[0].split('/').pop() || 'bild';
  const clean = base.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return clean || 'bild';
}

/** Öffentliche Adresse eines Bucket-Pfads. */
export function publicUrl(src, supabaseUrl) {
  if (/^https?:\/\//.test(src)) return src;
  if (!supabaseUrl) return null;
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/media/${String(src).replace(/^\/+/, '')}`;
}

/**
 * Bildpfad aus dem CMS in einen Website-Pfad verwandeln, bei Bedarf herunterladen.
 * @param {string} src
 * @param {{ supabaseUrl?: string, dir: string, dry?: boolean,
 *   exists: (file:string)=>boolean, write: (file:string, data:Uint8Array)=>void,
 *   fetchImpl?: typeof fetch }} o   dir = Pfad zu public/Bilder/cms
 * @returns {Promise<{ src: string|null, downloaded: boolean, note?: string }>}
 */
export async function resolveImage(src, { supabaseUrl, dir, dry = false, exists, write, fetchImpl = fetch }) {
  if (!src) return { src: null, downloaded: false, note: 'kein Bild angegeben' };
  if (OWN.test(src)) return { src, downloaded: false };
  const url = publicUrl(src, supabaseUrl);
  if (!url) return { src: null, downloaded: false, note: `${src}: SUPABASE_URL fehlt, Bild nicht geladen` };
  const name = localName(src);
  const file = `${dir}/${name}`;
  const target = `/Bilder/cms/${name}`;
  if (exists(file)) return { src: target, downloaded: false };
  if (dry) return { src: target, downloaded: false, note: `${src} würde nach ${target} geladen` };
  const res = await fetchImpl(url);
  if (!res.ok) return { src: null, downloaded: false, note: `${src}: Download HTTP ${res.status}` };
  write(file, new Uint8Array(await res.arrayBuffer()));
  return { src: target, downloaded: true };
}
