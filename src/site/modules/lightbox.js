/**
 * Lightbox: Galerie-Bilder (a[data-lightbox]) öffnen vergrößert in einem
 * <dialog>. Ohne JS führt der Link direkt zur Bilddatei (Progressive
 * Enhancement). Escape, Schließen-Button und Klick neben das Bild schließen;
 * der Fokus kehrt zum auslösenden Link zurück (Standard von <dialog>).
 */
import { t, LANG_EVENT } from '../i18n/index.js';

let dialog = null;

function build() {
  dialog = document.createElement('dialog');
  dialog.className = 'lightbox';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'lightbox-close';
  close.setAttribute('aria-label', t('lightbox.close'));
  close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  close.addEventListener('click', () => dialog.close());

  const figure = document.createElement('figure');
  figure.className = 'lightbox-figure';
  const img = document.createElement('img');
  img.alt = '';
  const caption = document.createElement('figcaption');
  figure.append(img, caption);

  dialog.append(close, figure);
  // Klick auf den Rand (außerhalb der Figur) trifft das Dialog-Element selbst.
  dialog.addEventListener('click', (ev) => { if (ev.target === dialog) dialog.close(); });
  window.addEventListener(LANG_EVENT, () => close.setAttribute('aria-label', t('lightbox.close')));
  document.body.append(dialog);
  return dialog;
}

/** Öffnet das Bild; gibt das <dialog> zurück (für Tests). */
export function openLightbox(src, caption = '') {
  const dlg = dialog?.isConnected ? dialog : build(); // neu aufbauen, falls der Dialog aus dem DOM entfernt wurde
  const img = dlg.querySelector('img');
  img.src = src;
  img.alt = caption;
  dlg.querySelector('figcaption').textContent = caption;
  dlg.setAttribute('aria-label', caption || t('lightbox.close'));
  if (typeof dlg.showModal === 'function') dlg.showModal();
  else dlg.setAttribute('open', '');
  return dlg;
}

export function initLightbox() {
  document.addEventListener('click', (ev) => {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
    const link = ev.target.closest('a[data-lightbox]');
    if (!link) return;
    ev.preventDefault();
    const figcaption = link.closest('figure')?.querySelector('figcaption');
    const caption = figcaption?.textContent.trim() || link.querySelector('img')?.alt || '';
    openLightbox(link.getAttribute('href'), caption);
  });
}
