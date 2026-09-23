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

export function initBands() {
  collapseAll();

  if (document[WIRED]) return;
  document[WIRED] = true;

  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.band-toggle');
    if (!btn) return;
    ev.preventDefault();
    toggle(btn, btn.getAttribute('aria-expanded') !== 'true');
  });
}
