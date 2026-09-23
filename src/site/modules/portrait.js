/**
 * Autoren-Portrait ([data-portrait-src]).
 * Das Bild wird erst per JS geladen, damit ein fehlendes Portrait weder den
 * Build bricht noch ein kaputtes Bild zeigt: Fallback ist ein Platzhalter
 * mit Initialen.
 */
import { t, LANG_EVENT } from '../i18n/index.js';

function showPlaceholder(box) {
  box.innerHTML = '';
  const ph = document.createElement('div');
  ph.className = 'ph';
  const initials = document.createElement('span');
  initials.className = 'initials';
  initials.textContent = 'JL';
  const hint = document.createElement('span');
  hint.textContent = t('people.portrait.placeholder');
  ph.append(initials, hint);
  box.append(ph);
  window.addEventListener(LANG_EVENT, () => {
    hint.textContent = t('people.portrait.placeholder');
  });
}

/** Startet das Laden; gibt das Bild-Element zurück (für Tests). */
export function initPortrait() {
  const box = document.querySelector('[data-portrait-src]');
  if (!box) return null;

  const img = new Image();
  img.alt = box.getAttribute('data-portrait-alt') || '';
  img.addEventListener('load', () => { box.innerHTML = ''; box.append(img); });
  img.addEventListener('error', () => showPlaceholder(box));
  img.src = box.getAttribute('data-portrait-src');
  return img;
}
