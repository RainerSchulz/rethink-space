/**
 * RETHINK SPACE — i18n
 * Die Website erscheint ausschließlich auf Englisch — der DE/EN-Schalter ist
 * entfernt. Das deutsche Wörterbuch bleibt erhalten, damit die zweite Sprache
 * später ohne Umbau wieder eingeschaltet werden kann: detectInitialLang()
 * zurücksetzen und den Schalter in den Header aufnehmen.
 */
import { DE } from './de.js';
import { EN } from './en.js';

const DICT = { de: DE, en: EN };
export const LANG_EVENT = 'rethink:langchange';

/** Einsprachig: immer Englisch, unabhängig von Browser und gespeicherter Wahl. */
export function detectInitialLang() {
  return 'en';
}

let _lang = detectInitialLang();

/** Übersetzung abrufen — unbekannter Schlüssel kommt unverändert zurück. */
export function t(key) {
  return DICT[_lang]?.[key] ?? DICT.en[key] ?? key;
}

export function getLang() {
  return _lang;
}

/**
 * Alle übersetzbaren Elemente im DOM aktualisieren:
 *   data-i18n             → textContent
 *   data-i18n-content     → content-Attribut (meta)
 *   data-i18n-aria-label  → aria-label
 *   data-i18n-placeholder → placeholder
 */
export function applyLang(root = document) {
  root.documentElement.setAttribute('lang', _lang);

  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  root.querySelectorAll('[data-i18n-content]').forEach((el) => {
    el.setAttribute('content', t(el.getAttribute('data-i18n-content')));
  });
  root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
  });
}

/** Sprache umschalten, DOM aktualisieren, Komponenten benachrichtigen.
 *  Ohne Schalter ruft die Website das nicht auf; die Funktion trägt die
 *  zweisprachige Fassung für eine spätere Wiedereinführung. */
export function setLang(lang) {
  if (lang !== 'de' && lang !== 'en') return;
  _lang = lang;
  applyLang();
  window.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: { lang } }));
}
