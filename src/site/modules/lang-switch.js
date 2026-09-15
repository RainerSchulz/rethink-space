/**
 * Sprachschalter DE/EN im Header (.lang button[data-lang]).
 */
import { getLang, setLang, LANG_EVENT } from '../i18n/index.js';

function markActive(lang) {
  document.querySelectorAll('.lang button[data-lang]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.lang === lang));
  });
}

export function initLangSwitch() {
  markActive(getLang());

  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.lang button[data-lang]');
    if (!btn) return;
    setLang(btn.dataset.lang);
  });

  window.addEventListener(LANG_EVENT, (ev) => markActive(ev.detail.lang));
}
