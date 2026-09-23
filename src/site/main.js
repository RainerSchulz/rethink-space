/**
 * RETHINK SPACE — Vite Entry
 * Das Stylesheet ist im HTML verlinkt (kein Aufblitzen ohne CSS); hier
 * werden nur die Module gestartet. Seiten-Module (Formular, Portrait) laufen
 * nach jedem Seitenwechsel des Routers erneut, weil <main> dann neu ist.
 */
import { applyLang } from './i18n/index.js';
import { initGate } from './modules/gate.js';
import { initNav, markCurrentPage, closeMenu } from './modules/nav.js';
import { initRouter, PAGE_EVENT } from './modules/router.js';
import { initContact } from './modules/contact.js';
import { initPortrait } from './modules/portrait.js';
import { initLightbox } from './modules/lightbox.js';
import { initChat } from './modules/chat.js';

function initPage() {
  applyLang();
  markCurrentPage();
  initContact();
  initPortrait();
}

initGate();     // Testphase: Anmeldemaske; ohne VITE_GATE_HASH ohne Wirkung
initNav();
initLightbox(); // vor dem Router: Galerie-Klicks werden hier abgefangen
initChat();     // Widget lebt außerhalb von <main>; ohne VITE_CHAT_ENDPOINT bleibt es aus
initRouter();
initPage();

window.addEventListener(PAGE_EVENT, () => {
  closeMenu();
  initPage();
  // Fokus auf den neuen Inhalt setzen, damit Screenreader und Tastatur beim
  // Seitenwechsel ohne Neuladen nicht im alten Header hängen bleiben.
  document.querySelector('main')?.focus({ preventScroll: true });
});
