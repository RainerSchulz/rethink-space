/**
 * Feature: Seiten-Module (nav, bands, contact, portrait)
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

  it('Scenario: Startseite markiert keinen Nav-Link', async () => {
    window.history.pushState({}, '', '/');
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
  const FORM = '<form data-contact novalidate>'
    + '<input name="name" value="Ada">'
    + '<input name="email" value="ada@example.com">'
    + '<textarea name="message">Hallo</textarea>'
    + '<input name="website" value="">'
    + '<button type="submit">x</button>'
    + '<p class="form-status" hidden tabindex="-1">Hinweis</p></form>';

  const absenden = () => {
    const ev = new Event('submit', { cancelable: true, bubbles: true });
    document.querySelector('form').dispatchEvent(ev);
    return ev;
  };
  const warte = () => new Promise((r) => setTimeout(r, 0));

  beforeEach(() => { delete window.RETHINK_CONTACT_ENDPOINT; vi.unstubAllGlobals(); });

  it('Scenario: ohne Endpoint bleibt es beim ehrlichen Hinweis', async () => {
    document.body.innerHTML = FORM;
    const { initContact } = await fresh('../../src/site/modules/contact.js');
    initContact();
    const ev = absenden();
    expect(ev.defaultPrevented).toBe(true);
    const note = document.querySelector('.form-status');
    expect(note.hidden).toBe(false);
    expect(note.textContent).toMatch(/not yet connected/i);
  });

  it('Scenario: mit Endpoint wird gesendet, das Formular geleert und gedankt', async () => {
    document.body.innerHTML = FORM;
    window.RETHINK_CONTACT_ENDPOINT = 'https://test.example/contact';
    const gesendet = [];
    vi.stubGlobal('fetch', (url, opts) => {
      gesendet.push({ url, body: JSON.parse(opts.body) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
    });
    const { initContact } = await fresh('../../src/site/modules/contact.js');
    initContact();
    absenden();
    await warte();
    expect(gesendet).toHaveLength(1);
    expect(gesendet[0].body).toMatchObject({ name: 'Ada', email: 'ada@example.com', message: 'Hallo' });
    expect(gesendet[0].body).toHaveProperty('website', ''); // Honigtopf wird mitgeschickt
    // form.reset() stellt die Vorgabewerte wieder her, es leert nicht.
    expect(document.querySelector('[name="message"]').value).toBe('Hallo');
    expect(document.querySelector('.form-status').dataset.art).toBe('erfolg');
  });

  it('Scenario: Fehlercodes der Funktion werden übersetzt, nicht roh gezeigt', async () => {
    document.body.innerHTML = FORM;
    window.RETHINK_CONTACT_ENDPOINT = 'https://test.example/contact';
    vi.stubGlobal('fetch', () => Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'rate_limited' }) }));
    const { initContact } = await fresh('../../src/site/modules/contact.js');
    initContact();
    absenden();
    await warte();
    const note = document.querySelector('.form-status');
    expect(note.dataset.art).toBe('fehler');
    expect(note.textContent).toMatch(/Too many/i);
    expect(note.textContent).not.toMatch(/rate_limited/);
  });

  it('Scenario: bricht die Verbindung ab, wird auf die E-Mail-Adresse verwiesen', async () => {
    document.body.innerHTML = FORM;
    window.RETHINK_CONTACT_ENDPOINT = 'https://test.example/contact';
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
    const { initContact } = await fresh('../../src/site/modules/contact.js');
    initContact();
    absenden();
    await warte();
    const note = document.querySelector('.form-status');
    expect(note.dataset.art).toBe('fehler');
    expect(note.textContent).toMatch(/contact@rethink\.space/);
  });

  it('Scenario: ohne Formular passiert nichts', async () => {
    document.body.innerHTML = '';
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
