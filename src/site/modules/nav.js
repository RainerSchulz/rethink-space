/**
 * Navigation: Mobilmenü (Burger) und Markierung der aktiven Seite.
 */

/** "/pages/lunar-habitato/index.html" und "/pages/lunar-habitato" → "/pages/lunar-habitato/" */
function normalizePath(p) {
  return p.toLowerCase().replace(/index\.html$/, '').replace(/\/?$/, '/');
}

/**
 * Seiten, die im Menü unter einem anderen Punkt stehen (Inhaber 27.11.2026): People und Contact erreicht man über
 * die Kacheln der Seite „About“ — dort ist „About“ markiert (aria-current="true": Bereich, nicht die Seite selbst).
 */
export const SECTION_OF = { '/pages/people/': '/pages/about/', '/pages/contact/': '/pages/about/' };

export function markCurrentPage() {
  const here = normalizePath(location.pathname);
  const section = SECTION_OF[here];
  document.querySelectorAll('.nav a[href]').forEach((a) => {
    const href = normalizePath(a.getAttribute('href'));
    if (href === here) a.setAttribute('aria-current', 'page');
    else if (href === section) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
}

function toggleMenu(burger, open) {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const isOpen = open ?? !nav.classList.contains('open');
  nav.classList.toggle('open', isOpen);
  burger.setAttribute('aria-expanded', String(isOpen));
}

export function closeMenu() {
  const burger = document.querySelector('.burger');
  if (burger && document.querySelector('.nav.open')) toggleMenu(burger, false);
}

export function initNav() {
  markCurrentPage();

  document.addEventListener('click', (ev) => {
    const burger = ev.target.closest('.burger');
    if (burger) { toggleMenu(burger); return; }
    // Klick außerhalb der Navigation schließt das offene Menü.
    if (!ev.target.closest('.nav')) closeMenu();
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') closeMenu();
  });
}
