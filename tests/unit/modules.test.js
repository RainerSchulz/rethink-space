/**
 * Feature: Seiten-Module (nav, lang-switch, contact, portrait)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const HEADER = `
  <header class="site-header">
    <button class="burger" type="button" aria-expanded="false"></button>
    <nav class="nav" id="site-nav">
      <a href="/pages/vision/">Vision</a>
      <a href="/pages/design/">Design</a>
      <a class="btn-outline" href="/pages/kontakt/">Kontakt</a>
      <span class="lang">
        <button type="button" data-lang="de" aria-pressed="true">DE</button>
        <button type="button" data-lang="en" aria-pressed="false">EN</button>
      </span>
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
    window.history.pushState({}, '', '/pages/design/');
  });

  it('Scenario: aktuelle Seite trägt aria-current="page"', async () => {
    const { initNav } = await fresh('../../src/site/modules/nav.js');
    initNav();
    expect(document.querySelector('a[href="/pages/design/"]').getAttribute('aria-current')).toBe('page');
    expect(document.querySelector('a[href="/pages/vision/"]').hasAttribute('aria-current')).toBe(false);
  });

  it('Scenario: auch /pages/design/index.html und /pages/design werden erkannt', async () => {
    for (const path of ['/pages/design/index.html', '/pages/design']) {
      window.history.pushState({}, '', path);
      const { initNav } = await fresh('../../src/site/modules/nav.js');
      initNav();
      expect(document.querySelector('a[href="/pages/design/"]').getAttribute('aria-current'), path).toBe('page');
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

describe('Feature: Sprachschalter (modules/lang-switch.js)', () => {
  beforeEach(() => {
    document.body.innerHTML = HEADER + '<p id="probe" data-i18n="nav.contact">Contact</p>';
  });

  it('Scenario: Start markiert EN als aktiv', async () => {
    const { initLangSwitch } = await fresh('../../src/site/modules/lang-switch.js');
    initLangSwitch();
    expect(document.querySelector('[data-lang="en"]').getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('[data-lang="de"]').getAttribute('aria-pressed')).toBe('false');
  });

  it('Scenario: Klick auf DE übersetzt die Seite und markiert den Button', async () => {
    const { initLangSwitch } = await fresh('../../src/site/modules/lang-switch.js');
    initLangSwitch();
    document.querySelector('.lang button[data-lang="de"]').click();
    expect(document.getElementById('probe').textContent).toBe('Kontakt');
    expect(document.querySelector('[data-lang="de"]').getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('[data-lang="en"]').getAttribute('aria-pressed')).toBe('false');
    expect(document.documentElement.lang).toBe('de');
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
