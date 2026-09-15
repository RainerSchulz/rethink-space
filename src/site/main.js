/**
 * RE-THINK SPACE — Vite Entry
 * Das Stylesheet ist im HTML verlinkt (kein Aufblitzen ohne CSS); hier
 * werden nur die Module gestartet. Seiten-Module (Formular, Portrait) laufen
 * nach jedem Seitenwechsel des Routers erneut, weil <main> dann neu ist.
 */
import { applyLang } from './i18n/index.js';
import { initLangSwitch } from './modules/lang-switch.js';
import { initNav, markCurrentPage, closeMenu } from './modules/nav.js';
import { initRouter, PAGE_EVENT } from './modules/router.js';
import { initContact } from './modules/contact.js';
import { initPortrait } from './modules/portrait.js';

function initPage() {
  applyLang();
  markCurrentPage();
  initContact();
  initPortrait();
}

initLangSwitch();
initNav();
initRouter();
initPage();

window.addEventListener(PAGE_EVENT, () => {
  closeMenu();
  initPage();
});
