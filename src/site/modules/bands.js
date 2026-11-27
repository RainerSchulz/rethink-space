/**
 * Bänder auf /pages/lunar-habitato/: die Kachel selbst ist kein Link. Nur der
 * Knopf „Learn more“ klappt den Bereich direkt darunter auf — ohne Seitenwechsel.
 *
 * Alle Bereiche starten zugeklappt: das `hidden` steht schon im Markup, damit
 * beim Laden nichts kurz aufgeklappt aufblitzt, bevor JavaScript läuft.
 * initBands() setzt denselben Zustand noch einmal, damit er auch nach einem
 * Seitenwechsel des Routers stimmt.
 *
 * Die Verknüpfung läuft über aria-controls, sodass der Knopf auch für
 * Screenreader eindeutig zu seinem Bereich gehört. Ein Klick auf das Band
 * öffnet nichts — sonst wäre unklar, was bedienbar ist.
 */
const OPEN_CLASS = 'is-open';
// Merker am Dokument: ein zweiter initBands()-Aufruf darf den Klick-Horcher
// nicht erneut anhängen, sonst schaltet ein Klick zweimal und bliebe zu.
const WIRED = '__rethinkBandsWired';

function toggle(btn, open) {
  const panel = document.getElementById(btn.getAttribute('aria-controls'));
  if (!panel) return;
  btn.setAttribute('aria-expanded', String(open));
  panel.hidden = !open;
  panel.closest('.band-group')?.classList.toggle(OPEN_CLASS, open);
}

/** Alle Bereiche schließen und die Knöpfe zurücksetzen. */
export function collapseAll(root = document) {
  root.querySelectorAll('.band-toggle').forEach((btn) => toggle(btn, false));
}

/**
 * Sprungadresse auf einen Bereich (z. B. /pages/about/#band-contact — „Get in touch“ und die Weiterleitungen
 * der früheren Seiten People und Contact, Inhaber 27.11.2026): diesen Bereich aufklappen und die Kachel in den Blick holen. Andere Adressen bleiben unberührt.
 * @returns {boolean} ob ein Bereich aufgeklappt wurde
 */
export function openFromHash(hash = location.hash) {
  const id = decodeURIComponent(String(hash ?? '').replace(/^#/, ''));
  if (!/^band-[a-z0-9-]+$/.test(id)) return false;
  const btn = document.querySelector(`.band-toggle[aria-controls="${id}"]`);
  if (!btn) return false;
  toggle(btn, true);
  const group = btn.closest('.band-group');
  const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  group?.scrollIntoView?.({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
  return true;
}

export function initBands() {
  collapseAll();
  openFromHash();

  if (document[WIRED]) return;
  document[WIRED] = true;

  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.band-toggle');
    if (!btn) return;
    ev.preventDefault();
    toggle(btn, btn.getAttribute('aria-expanded') !== 'true');
  });
  window.addEventListener('hashchange', () => openFromHash());
}
