/**
 * RE-THINK SPACE — i18n
 * DE/EN Übersetzungen, Sprachwechsel, Anwendung auf data-i18n-Elemente.
 */
import { DE } from './de.js';
import { EN } from './en.js';

const DICT = { de: DE, en: EN };
const STORAGE_KEY = 'rethink_lang';
export const LANG_EVENT = 'rethink:langchange';

/** Englisch ist immer der Standard; Deutsch nur, wenn es einmal gewählt wurde. */
export function detectInitialLang() {
  let saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* Storage gesperrt */ }
  return saved === 'de' ? 'de' : 'en';
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

/** Sprache wechseln, speichern, DOM aktualisieren, Komponenten benachrichtigen. */
export function setLang(lang) {
  if (lang !== 'de' && lang !== 'en') return;
  _lang = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* Storage gesperrt */ }
  applyLang();
  window.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: { lang } }));
}
