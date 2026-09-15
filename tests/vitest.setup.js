// Globales Test-Setup für alle Vitest Unit-Tests (happy-dom).
import { beforeEach } from 'vitest';

// localStorage-Mock: unabhängig von der DOM-Bibliothek ein stabiler Store.
const store = new Map();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  },
  configurable: true,
});

beforeEach(() => {
  store.clear();
  // Tests gehen von einem deutschen Browser aus — die Seite muss trotzdem auf Englisch starten.
  Object.defineProperty(navigator, 'language', { value: 'de-DE', configurable: true });
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});
