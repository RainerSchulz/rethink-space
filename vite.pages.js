// Welche Seiten ein Build erzeugt (Muster: FORGE-Portal vite.pages.js).
//
// Ohne RETHINK_PAGES entsteht alles. Mit RETHINK_PAGES=landing,impressum
// nur die genannten Seiten — z. B. für ein Coming-Soon-Image.
import { resolve } from 'node:path';

export const PAGES = {
  root:        'index.html',                    // Weiterleitung auf /pages/landing/
  landing:     'pages/landing/index.html',
  vision:      'pages/vision/index.html',
  design:      'pages/design/index.html',
  space:       'pages/space/index.html',
  deployment:  'pages/deployment/index.html',
  'dual-use':  'pages/dual-use/index.html',
  ip:          'pages/ip/index.html',
  news:        'pages/news/index.html',
  autor:       'pages/autor/index.html',
  kontakt:     'pages/kontakt/index.html',
  impressum:   'pages/impressum/index.html',
  datenschutz: 'pages/datenschutz/index.html',
  notfound:    'pages/404/index.html',          // wird zusätzlich nach dist/404.html kopiert
};

export function selectPages(root, wanted = process.env.RETHINK_PAGES) {
  const names = (wanted ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const chosen = names.length > 0 ? names : Object.keys(PAGES);
  // Ein Tippfehler darf nicht still eine Seite weglassen — ohne Impressum
  // ginge die Seite sonst ungemerkt live.
  const unknown = chosen.filter((n) => !(n in PAGES));
  if (unknown.length > 0) {
    throw new Error(`RETHINK_PAGES: unbekannte Seite(n) ${unknown.join(', ')}. Bekannt: ${Object.keys(PAGES).join(', ')}`);
  }
  return Object.fromEntries(chosen.map((n) => [n, resolve(root, PAGES[n])]));
}
