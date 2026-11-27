/**
 * Navigation: Mobilmenü (Burger), Untermenü „About“ (People, Contact) und Markierung der aktiven Seite.
 */

/** "/pages/lunar-habitato/index.html" und "/pages/lunar-habitato" → "/pages/lunar-habitato/" */
function normalizePath(p) {
  return p.toLowerCase().replace(/index\.html$/, '').replace(/\/?$/, '/');
}

export function markCurrentPage() {
  const here = normalizePath(location.pathname);
  document.querySelectorAll('.nav a[href]').forEach((a) => {
    if (normalizePath(a.getAttribute('href')) === here) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  // „About“ unterstreichen, wenn eine seiner Seiten offen ist
  document.querySelectorAll('.nav-group').forEach((g) => {
    g.classList.toggle('current', Boolean(g.querySelector('a[aria-current="page"]')));
  });
}

/** Untermenü auf- oder zuklappen (am PC: Klick, Enter, Leertaste; Überfahren regelt das CSS). */
export function toggleGroup(group, open) {
  const isOpen = open ?? !group.classList.contains('open');
  group.classList.toggle('open', isOpen);
  group.querySelector('.nav-more')?.setAttribute('aria-expanded', String(isOpen));
}

function closeGroups(except) {
  document.querySelectorAll('.nav-group.open').forEach((g) => { if (g !== except) toggleGroup(g, false); });
}

function toggleMenu(burger, open) {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const isOpen = open ?? !nav.classList.contains('open');
  nav.classList.toggle('open', isOpen);
  burger.setAttribute('aria-expanded', String(isOpen));
}

export function closeMenu() {
  closeGroups();
  const burger = document.querySelector('.burger');
  if (burger && document.querySelector('.nav.open')) toggleMenu(burger, false);
}

export function initNav() {
  markCurrentPage();

  document.addEventListener('click', (ev) => {
    const burger = ev.target.closest('.burger');
    if (burger) { toggleMenu(burger); return; }
    const more = ev.target.closest('.nav-more');
    if (more) { const group = more.closest('.nav-group'); closeGroups(group); toggleGroup(group); return; }
    // Klick außerhalb der Navigation schließt das offene Menü; ein Link im Untermenü schließt es auch.
    if (!ev.target.closest('.nav')) closeMenu();
    else if (ev.target.closest('.nav-sub a')) closeGroups();
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    const group = document.querySelector('.nav-group.open');
    closeMenu();
    if (group?.contains(document.activeElement)) group.querySelector('.nav-more')?.focus();
  });

  // Tastatur: verlässt der Fokus das Untermenü, klappt es zu
  document.addEventListener('focusout', (ev) => {
    const group = ev.target.closest?.('.nav-group.open');
    if (group && !group.contains(ev.relatedTarget)) toggleGroup(group, false);
  });
}
