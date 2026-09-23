/**
 * Feature: Sprachlogik (src/site/i18n/index.js)
 *
 * Das Modul liest die Sprache beim Import — deshalb wird es je Test
 * frisch geladen (vi.resetModules + dynamischer Import).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

function setNavigatorLanguage(value) {
  Object.defineProperty(navigator, 'language', { value, configurable: true });
}

async function loadI18n() {
  vi.resetModules();
  return import('../../src/site/i18n/index.js');
}

beforeEach(() => setNavigatorLanguage('de-DE'));

describe('Feature: Startsprache — die Website ist einsprachig Englisch', () => {
  it('Scenario: deutscher Browser ohne gespeicherte Wahl → en', async () => {
    const { getLang } = await loadI18n();
    expect(getLang()).toBe('en');
  });

  it('Scenario: englischer Browser ohne gespeicherte Wahl → en', async () => {
    setNavigatorLanguage('en-US');
    const { getLang } = await loadI18n();
    expect(getLang()).toBe('en');
  });

  it('Scenario: eine früher gespeicherte Wahl wird ignoriert (kein Schalter mehr)', async () => {
    localStorage.setItem('rethink_lang', 'de');
    const { getLang } = await loadI18n();
    expect(getLang()).toBe('en');
  });
});

describe('Feature: t() Übersetzung', () => {
  it('liefert den Text der aktiven Sprache', async () => {
    const { t, setLang } = await loadI18n();
    expect(t('nav.contact')).toBe('Contact');
    setLang('de');
    expect(t('nav.contact')).toBe('Kontakt');
  });

  it('unbekannter Schlüssel kommt unverändert zurück', async () => {
    const { t } = await loadI18n();
    expect(t('gibt.es.nicht')).toBe('gibt.es.nicht');
  });
});

describe('Feature: applyLang() aktualisiert das DOM', () => {
  beforeEach(() => {
    document.head.innerHTML =
      '<title data-i18n="home.meta.title">x</title>' +
      '<meta name="description" data-i18n-content="home.meta.description" content="x">';
    document.body.innerHTML =
      '<button data-i18n-aria-label="nav.menu" aria-label="x"></button>' +
      '<a data-i18n="nav.author">x</a>' +
      '<input data-i18n-placeholder="contact.form.name" placeholder="x">';
  });

  it('setzt Text, content, aria-label, placeholder und html[lang]', async () => {
    const { applyLang, setLang } = await loadI18n();
    applyLang();
    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toBe('RETHINK SPACE – New Space Economy for Lunar Infrastructure');
    expect(document.querySelector('a').textContent).toBe('People');

    setLang('de');
    expect(document.documentElement.lang).toBe('de');
    expect(document.title).toBe('RETHINK SPACE – New Space Economy for Lunar Infrastructure');
    expect(document.querySelector('meta').getAttribute('content')).toMatch(/Design, Technologie und Umsetzung/);
    expect(document.querySelector('button').getAttribute('aria-label')).toBe('Menü');
    expect(document.querySelector('a').textContent).toBe('Menschen');
    expect(document.querySelector('input').getAttribute('placeholder')).toBe('Name');
  });
});

describe('Feature: setLang() — das Wörterbuch bleibt für eine spätere zweite Sprache nutzbar', () => {
  it('löst das Ereignis rethink:langchange aus', async () => {
    const { setLang, LANG_EVENT } = await loadI18n();
    const handler = vi.fn();
    window.addEventListener(LANG_EVENT, handler);
    setLang('de');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({ lang: 'de' });
  });

  it('ignoriert unbekannte Sprachen', async () => {
    const { setLang, getLang } = await loadI18n();
    setLang('fr');
    expect(getLang()).toBe('en');
  });
});
