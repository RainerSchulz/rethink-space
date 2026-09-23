/**
 * Feature: Seiten-Module (nav, contact, portrait)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const HEADER = `
  <header class="site-header">
    <button class="burger" type="button" aria-expanded="false"></button>
    <nav class="nav" id="site-nav">
      <a href="/pages/lunar-habitato/">Lunar Habitato</a>
      <a href="/pages/dual-use/">Dual Use</a>
      <a href="/pages/contact/">Contact</a>
    </nav>
  </header>
  <main><p>Inhalt</p></main>`;

async function fresh(path) {
  vi.resetModules();
  return import(path);
}

describe('Feature: Navigation (modules/nav.js)', () => {
  beforeEach(() => {
    document.body.innerHTML = HEADER;
    window.history.pushState({}, '', '/pages/dual-use/');
  });

  it('Scenario: aktuelle Seite trägt aria-current="page"', async () => {
    const { initNav } = await fresh('../../src/site/modules/nav.js');
    initNav();
    expect(document.querySelector('a[href="/pages/dual-use/"]').getAttribute('aria-current')).toBe('page');
    expect(document.querySelector('a[href="/pages/lunar-habitato/"]').hasAttribute('aria-current')).toBe(false);
  });

  it('Scenario: auch /pages/dual-use/index.html und /pages/dual-use werden erkannt', async () => {
    for (const path of ['/pages/dual-use/index.html', '/pages/dual-use']) {
      window.history.pushState({}, '', path);
      const { initNav } = await fresh('../../src/site/modules/nav.js');
      initNav();
      expect(document.querySelector('a[href="/pages/dual-use/"]').getAttribute('aria-current'), path).toBe('page');
    }
  });

  it('Scenario: Landing markiert keinen Nav-Link', async () => {
    window.history.pushState({}, '', '/pages/landing/');
    const { initNav } = await fresh('../../src/site/modules/nav.js');
    initNav();
    expect(document.querySelectorAll('[aria-current]')).toHaveLength(0);
  });

  it('Scenario: Burger öffnet und schließt das Menü inkl. aria-expanded', async () => {
    const { initNav } = await fresh('../../src/site/modules/nav.js');
    initNav();
    const burger = document.querySelector('.burger');
    const nav = document.querySelector('.nav');
    burger.click();
    expect(nav.classList.contains('open')).toBe(true);
    expect(burger.getAttribute('aria-expanded')).toBe('true');
    burger.click();
    expect(nav.classList.contains('open')).toBe(false);
    expect(burger.getAttribute('aria-expanded')).toBe('false');
  });

  it('Scenario: Klick außerhalb schließt das offene Menü', async () => {
    const { initNav } = await fresh('../../src/site/modules/nav.js');
    initNav();
    document.querySelector('.burger').click();
    document.querySelector('main p').click();
    expect(document.querySelector('.nav').classList.contains('open')).toBe(false);
  });

  it('Scenario: Escape schließt das offene Menü', async () => {
    const { initNav } = await fresh('../../src/site/modules/nav.js');
    initNav();
    document.querySelector('.burger').click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.nav').classList.contains('open')).toBe(false);
  });
});

describe('Feature: Bänder (modules/bands.js)', () => {
  const BANDS = `
    <div class="band-group">
      <div class="band"><div class="band-title">
        <h1 class="band-h">Eins</h1>
        <button class="arrow-link band-toggle" type="button" aria-expanded="false" aria-controls="band-1">Learn more</button>
      </div></div>
      <div class="band-panel" id="band-1" hidden><p>Text eins</p></div>
    </div>
    <div class="band-group">
      <div class="band"><div class="band-title">
        <h2 class="band-h">Zwei</h2>
        <button class="arrow-link band-toggle" type="button" aria-expanded="false" aria-controls="band-2">Learn more</button>
      </div></div>
      <div class="band-panel" id="band-2" hidden><p>Text zwei</p></div>
    </div>`;

  beforeEach(() => { document.body.innerHTML = BANDS; });

  it('Scenario: alle Bereiche starten zugeklappt — im Markup und nach initBands()', async () => {
    expect(document.getElementById('band-1').hidden).toBe(true); // schon ohne JS zu
    expect(document.getElementById('band-2').hidden).toBe(true);
    const { initBands } = await fresh('../../src/site/modules/bands.js');
    initBands();
    expect(document.getElementById('band-1').hidden).toBe(true);
    expect(document.getElementById('band-2').hidden).toBe(true);
    expect(document.querySelectorAll('.band-toggle[aria-expanded="true"]')).toHaveLength(0);
  });

  it('Scenario: Klick auf „Learn more" öffnet nur den eigenen Bereich', async () => {
    const { initBands } = await fresh('../../src/site/modules/bands.js');
    initBands();
    document.querySelector('[aria-controls="band-1"]').click();
    expect(document.getElementById('band-1').hidden).toBe(false);
    expect(document.querySelector('[aria-controls="band-1"]').getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById('band-2').hidden).toBe(true);
    expect(document.querySelector('.band-group').classList.contains('is-open')).toBe(true);
  });

  it('Scenario: zweiter Klick schließt wieder', async () => {
    const { initBands } = await fresh('../../src/site/modules/bands.js');
    initBands();
    const btn = document.querySelector('[aria-controls="band-2"]');
    btn.click();
    btn.click();
    expect(document.getElementById('band-2').hidden).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('Scenario: Klick auf das Band selbst öffnet nichts', async () => {
    const { initBands } = await fresh('../../src/site/modules/bands.js');
    initBands();
    document.querySelector('.band-h').click();
    expect(document.getElementById('band-1').hidden).toBe(true);
  });
});

describe('Feature: Kontaktformular (modules/contact.js)', () => {
  it('Scenario: Absenden zeigt den Hinweis und lädt die Seite nicht neu', async () => {
    document.body.innerHTML =
      '<form data-contact novalidate><button type="submit">x</button><p class="form-status" hidden>Hinweis</p></form>';
    const { initContact } = await fresh('../../src/site/modules/contact.js');
    initContact();
    const ev = new Event('submit', { cancelable: true, bubbles: true });
    document.querySelector('form').dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.querySelector('.form-status').hidden).toBe(false);
  });

  it('Scenario: ohne Formular passiert nichts', async () => {
    const { initContact } = await fresh('../../src/site/modules/contact.js');
    expect(() => initContact()).not.toThrow();
  });
});

describe('Feature: Autoren-Portrait (modules/portrait.js)', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<div class="portrait" data-portrait-src="Bilder/Lierfeld.jpg" data-portrait-alt="Dr. Johannes Lierfeld"></div>';
  });

  it('Scenario: Bild lädt → wird eingesetzt', async () => {
    const { initPortrait } = await fresh('../../src/site/modules/portrait.js');
    const img = initPortrait();
    img.dispatchEvent(new Event('load'));
    const inserted = document.querySelector('.portrait img');
    expect(inserted).not.toBeNull();
    expect(inserted.alt).toBe('Dr. Johannes Lierfeld');
  });

  it('Scenario: Bild fehlt → Platzhalter mit Initialen und übersetztem Hinweis', async () => {
    const { initPortrait } = await fresh('../../src/site/modules/portrait.js');
    const { setLang } = await import('../../src/site/i18n/index.js');
    const img = initPortrait();
    img.dispatchEvent(new Event('error'));
    expect(document.querySelector('.portrait .initials').textContent).toBe('JL');
    expect(document.querySelector('.portrait .ph').textContent).toContain('Add portrait');
    setLang('de');
    expect(document.querySelector('.portrait .ph').textContent).toContain('Portrait einsetzen');
  });
});

describe('Feature: Lightbox (modules/lightbox.js)', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main><div class="gallery">
        <figure><a class="gallery-item" href="/Bilder/test.jpeg" data-lightbox><img src="/Bilder/test.jpeg" alt=""></a><figcaption>Dome structure</figcaption></figure>
      </div></main>`;
  });

  it('Scenario: Klick auf ein Galerie-Bild öffnet den Dialog mit Bild und Bildunterschrift', async () => {
    const { initLightbox } = await fresh('../../src/site/modules/lightbox.js');
    initLightbox();
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    document.querySelector('.gallery-item img').dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true); // kein Seitenwechsel zur Bilddatei
    const dlg = document.querySelector('dialog.lightbox');
    expect(dlg.hasAttribute('open')).toBe(true);
    expect(dlg.querySelector('img').getAttribute('src')).toBe('/Bilder/test.jpeg');
    expect(dlg.querySelector('figcaption').textContent).toBe('Dome structure');
    expect(dlg.querySelector('.lightbox-close').getAttribute('aria-label')).toBe('Close image');
  });

  it('Scenario: Schließen-Button schließt den Dialog, ein zweiter Klick nutzt denselben Dialog', async () => {
    const { initLightbox } = await fresh('../../src/site/modules/lightbox.js');
    initLightbox();
    const click = () => document.querySelector('.gallery-item').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    click();
    document.querySelector('.lightbox-close').click();
    expect(document.querySelector('dialog.lightbox').hasAttribute('open')).toBe(false);
    click();
    expect(document.querySelectorAll('dialog.lightbox')).toHaveLength(1);
    expect(document.querySelector('dialog.lightbox').hasAttribute('open')).toBe(true);
  });
});
