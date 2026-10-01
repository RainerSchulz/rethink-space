/**
 * Veröffentlichter Stand für das CMS (Tabelle cms_publishes, rethink-cms 0007).
 *
 * Nach einem erfolgreichen Veröffentlichen hält die Website fest, WAS sie aus
 * dem CMS übernommen hat. Das CMS vergleicht seinen aktuellen Stand damit und
 * markiert nur, was davon abweicht, als „noch nicht online“. Deshalb stehen hier
 * die Werte so, wie sie im CMS stehen (Bildpfade aus dem Bucket, nicht die nach
 * /Bilder/cms/ kopierten), und nur, was wirklich übernommen wurde: übersprungene
 * Schlüssel oder Kacheln fehlen und bleiben im CMS markiert.
 */

/**
 * @param {{ pages: object[] }} content   Export, wie apply-content ihn verarbeitet hat
 * @param {(key: string) => boolean} applied   wurde der Schlüssel übernommen?
 */
export function toSnapshot(content, applied = () => true) {
  const pages = {};
  for (const p of content.pages ?? []) {
    const texts = {};
    (p.keys ?? []).forEach((k, i) => {
      if (!applied(k.key)) return;
      texts[k.key] = { en: k.en ?? '', de: k.de ?? '', tag: k.tag ?? '', position: k.position ?? i, ...(k.hidden ? { hidden: true } : {}) };
    });
    pages[p.slug] = {
      texts,
      images: (p.images ?? []).map((i) => ({ src: i.src, alt: i.alt ?? '', ...(i.hidden ? { hidden: true } : {}) })),
      bands: (p.bands ?? []).map((b) => ({
        id: b.id, titleKey: b.titleKey, textKey: b.textKey, src: b.image?.src ?? null, focus: b.image?.focus ?? null,
        ...(b.image?.focusX ? { focusX: b.image.focusX } : {}), ...(b.image?.zoom ? { zoom: b.image.zoom } : {}),
      })),
      // Listen (cms:list): je Name die Kennungen in Reihenfolge
      ...(p.lists ? { lists: Object.fromEntries(Object.entries(p.lists).map(([n, items]) => [n, items.map((i) => i.id)])) } : {}),
    };
  }
  return { version: 1, pages };
}
