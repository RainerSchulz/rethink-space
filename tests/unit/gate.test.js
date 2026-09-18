/**
 * Feature: Zugangsschutz der Testphase (modules/gate.js)
 * Ohne VITE_GATE_HASH ist die Seite offen; mit Hash erscheint die Maske,
 * falsche Daten werden abgewiesen, richtige Daten schalten frei und bleiben
 * gespeichert.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const EMAIL = 'test@rethink.space';
const PASSWORD = 'Re-Think-Space-26';
const HASH = '6987d5d14499d7c677ed0aa6eb68e7745e43448197caf60cbcba7d68ecd30d57';
const HASH_ALT = '14f2c131227c3c03ec79b35cd46b68a58467ae6ad9262976cc0d090f5590a69e'; // alte Schreibweise test@re-think.space

async function fresh(path) {
  vi.resetModules();
  return import(path);
}

const submit = (email, password, remember = true) => {
  document.querySelector('#gate-email').value = email;
  document.querySelector('#gate-password').value = password;
  document.querySelector('#gate-remember').checked = remember;
  document.querySelector('.gate-box').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
};

describe('Feature: Zugangsschutz (modules/gate.js)', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.body.innerHTML = '<header>Kopf</header><main><p>Inhalt</p></main>';
    localStorage.clear();
    sessionStorage.clear();
    vi.stubEnv('VITE_GATE_HASH', '');
    delete window.RETHINK_GATE_HASH;
  });
  afterEach(() => { vi.unstubAllEnvs(); localStorage.clear(); sessionStorage.clear(); });

  it('Scenario: ohne konfigurierten Hash bleibt die Seite offen', async () => {
    const { initGate } = await fresh('../../src/site/modules/gate.js');
    expect(initGate()).toBe(true);
    expect(document.querySelector('.site-gate')).toBeNull();
    expect(document.documentElement.classList.contains('is-locked')).toBe(false);
  });

  it('Scenario: mit Hash erscheint die Maske und der Inhalt ist gesperrt', async () => {
    window.RETHINK_GATE_HASH = HASH;
    const { initGate } = await fresh('../../src/site/modules/gate.js');
    expect(initGate()).toBe(false);
    expect(document.documentElement.classList.contains('is-locked')).toBe(true);
    const gate = document.querySelector('.site-gate');
    expect(gate.getAttribute('aria-modal')).toBe('true');
    expect(document.querySelector('#gate-email').autocomplete).toBe('username');
    expect(document.querySelector('#gate-password').autocomplete).toBe('current-password');
  });

  it('Scenario: falsche Daten werden abgewiesen, richtige schalten frei', async () => {
    window.RETHINK_GATE_HASH = HASH;
    const { initGate } = await fresh('../../src/site/modules/gate.js');
    initGate();

    submit(EMAIL, 'falsch');
    await vi.waitFor(() => expect(document.querySelector('.gate-error').hidden).toBe(false));
    expect(document.querySelector('.site-gate')).not.toBeNull();

    submit(EMAIL, PASSWORD);
    await vi.waitFor(() => expect(document.querySelector('.site-gate')).toBeNull());
    expect(document.documentElement.classList.contains('is-locked')).toBe(false);
    expect(localStorage.getItem('rethink_gate')).toBe(HASH);
  });

  it('Scenario: nach der Anmeldung bleibt die Seite beim nächsten Besuch offen', async () => {
    window.RETHINK_GATE_HASH = HASH;
    localStorage.setItem('rethink_gate', HASH);
    const { initGate } = await fresh('../../src/site/modules/gate.js');
    expect(initGate()).toBe(true);
    expect(document.querySelector('.site-gate')).toBeNull();
  });

  it('Scenario: „Angemeldet bleiben“ steuert, ob die Freigabe dauerhaft gilt', async () => {
    window.RETHINK_GATE_HASH = HASH;
    const { initGate } = await fresh('../../src/site/modules/gate.js');
    initGate();

    submit(EMAIL, PASSWORD, false); // Haken entfernt
    await vi.waitFor(() => expect(document.querySelector('.site-gate')).toBeNull());
    expect(sessionStorage.getItem('rethink_gate')).toBe(HASH); // nur dieses Fenster
    expect(localStorage.getItem('rethink_gate')).toBeNull();
  });

  it('Scenario: Die Checkbox ist vorausgewählt', async () => {
    window.RETHINK_GATE_HASH = HASH;
    const { initGate } = await fresh('../../src/site/modules/gate.js');
    initGate();
    expect(document.querySelector('#gate-remember').checked).toBe(true);
  });

  it('Scenario: mehrere Zugänge (Komma-Liste) sind erlaubt', async () => {
    window.RETHINK_GATE_HASH = `${HASH_ALT}, ${HASH}`;
    const { initGate } = await fresh('../../src/site/modules/gate.js');
    initGate();
    submit('test@re-think.space', PASSWORD);
    await vi.waitFor(() => expect(document.querySelector('.site-gate')).toBeNull());
    expect(localStorage.getItem('rethink_gate')).toBe(HASH_ALT);
  });
});
