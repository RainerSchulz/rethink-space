/**
 * Holt den Inhaltsstand direkt aus den CMS-Tabellen in Supabase und gibt ihn
 * in derselben Form zurück wie der Export aus dem CMS (`exportContent()`).
 * Damit kann scripts/apply-content.mjs im GitHub-Lauf ohne heruntergeladene
 * Datei arbeiten.
 *
 * Gelesen wird über PostgREST mit dem Service-Role-Key — der umgeht RLS und
 * gehört deshalb ausschließlich in GitHub-Secrets, nie in eine VITE_-Variable.
 */

async function hole(url, key, pfad) {
  const res = await fetch(`${url}/rest/v1/${pfad}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`${pfad}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

export async function ladeInhalt({ url, key }) {
  if (!url || !key) throw new Error('SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY fehlen');

  const [seiten, texte, bilder] = await Promise.all([
    hole(url, key, 'cms_pages?select=slug,url,title,updated_at&order=slug'),
    hole(url, key, 'cms_texts?select=key,page_slug,tag,position,en,de&order=page_slug,position'),
    hole(url, key, 'cms_images?select=page_slug,position,src,alt&order=page_slug,position'),
  ]);

  const texteJeSeite = new Map();
  for (const t of texte) {
    if (!texteJeSeite.has(t.page_slug)) texteJeSeite.set(t.page_slug, []);
    texteJeSeite.get(t.page_slug).push({ key: t.key, tag: t.tag ?? '', attr: 'text', en: t.en ?? '', de: t.de ?? '' });
  }
  const bilderJeSeite = new Map();
  for (const i of bilder) {
    if (!bilderJeSeite.has(i.page_slug)) bilderJeSeite.set(i.page_slug, []);
    bilderJeSeite.get(i.page_slug).push({ src: i.src, alt: i.alt ?? '' });
  }

  return {
    generatedAt: null,
    exportedAt: new Date().toISOString(),
    quelle: 'supabase',
    pages: seiten.map((p) => ({
      slug: p.slug,
      url: p.url ?? '',
      title: p.title ?? '',
      changedAt: p.updated_at ?? null,
      keys: texteJeSeite.get(p.slug) ?? [],
      images: bilderJeSeite.get(p.slug) ?? [],
    })),
    media: [],
  };
}
