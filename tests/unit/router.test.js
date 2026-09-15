/**
 * Feature: Seitenwechsel ohne Neuladen (modules/router.js)
 *
 * fetch wird gemockt; happy-dom hat keine View Transitions, also läuft der
 * Fallback (Ausblenden → Tausch → Einblenden).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const PAGE = (title, h1) => `<!DOCTYPE html><html lang="en"><head>
<title data-i18n="x">${title}</title>
<meta name="description" content="${title} desc">
<link rel="canonical" href="https://re-think-space.de/pages/vision/">
<meta property="og:title" content="${title}">
</head><body>
<header class="site-header">FREMDER HEADER</header>
<main><h1>${h1}</h1></main>
<footer>FREMDER FOOTER</footer>
</body></html>`;

async function fresh() {
  vi.resetModules();
  return import('../../src/site/modules/router.js');
}

/**
 * Klick auslösen und festhalten, ob der Router ihn übernommen hat.
 * Der letzte Listener unterdrückt die Browser-Navigation, die happy-dom
 * ohnehin nicht kann ("Not implemented: navigation").
 */
function click(el, init = {}) {
  const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
  const seen = { defaultPrevented: false };
  const last = (e) => { seen.defaultPrevented = e.defaultPrevented; e.preventDefault(); };
  window.addEventListener('click', last, { once: true });
  el.dispatchEvent(ev);
  return seen;
}

beforeEach(() => {
  window.history.replaceState({}, '', '/pages/landing/');
  document.head.innerHTML =
    '<title>Landing</title><meta name="description" content="landing"><link rel="canonical" href="https://re-think-space.de/pages/landing/">';
  document.body.innerHTML = `
    <header class="site-header"><nav class="nav"><a id="to-vision" href="/pages/vision/">Vision</a><a id="ext" href="https://example.com/">Ext</a></nav></header>
    <main><h1>Landing</h1></main>
    <footer id="footer">Footer</footer>`;
  globalThis.fetch = vi.fn(async (path) => ({
    ok: path === '/pages/vision/',
    status: path === '/pages/vision/' ? 200 : 404,
    text: async () => PAGE('Vision – RE-THINK SPACE', 'Space for tomorrow.'),
  }));
  window.scrollTo = vi.fn();
});

describe('Feature: interner Link tauscht nur <main>', () => {
  it('Scenario: Klick lädt die Seite per fetch, Header/Footer bleiben dieselben Elemente', async () => {
    const { initRouter, PAGE_EVENT } = await fresh();
    initRouter();
    const header = document.querySelector('header');
    const footer = document.getElementById('footer');
    const changed = vi.fn();
    window.addEventListener(PAGE_EVENT, changed);

    const ev = click(document.getElementById('to-vision'));
    expect(ev.defaultPrevented).toBe(true);

    await vi.waitFor(() => expect(document.querySelector('main h1').textContent).toBe('Space for tomorrow.'));
    expect(fetch).toHaveBeenCalledWith('/pages/vision/', expect.anything());
    expect(document.querySelector('header')).toBe(header);
    expect(document.getElementById('footer')).toBe(footer);
    expect(document.body.textContent).not.toContain('FREMDER');
    expect(location.pathname).toBe('/pages/vision/');
    expect(document.title).toBe('Vision – RE-THINK SPACE');
    expect(document.querySelector('link[rel="canonical"]').href).toBe('https://re-think-space.de/pages/vision/');
    expect(document.querySelector('meta[property="og:title"]').content).toBe('Vision – RE-THINK SPACE');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('Scenario: zweiter Aufruf derselben Seite kommt aus dem Cache', async () => {
    const { fetchPage } = await fresh();
    const url = new URL('/pages/vision/', location.href);
    await fetchPage(url);
    await fetchPage(url);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('Feature: Router greift nur ein, wo es sinnvoll ist', () => {
  it('Scenario: externer Link bleibt unangetastet', async () => {
    const { initRouter } = await fresh();
    initRouter();
    const ev = click(document.getElementById('ext'));
    expect(ev.defaultPrevented).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('Scenario: Strg-Klick (neuer Tab) bleibt unangetastet', async () => {
    const { initRouter } = await fresh();
    initRouter();
    const ev = click(document.getElementById('to-vision'), { ctrlKey: true });
    expect(ev.defaultPrevented).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('Scenario: Link auf die aktuelle Seite scrollt nur nach oben', async () => {
    const { initRouter } = await fresh();
    initRouter();
    document.querySelector('#to-vision').setAttribute('href', '/pages/landing/');
    const ev = click(document.getElementById('to-vision'));
    expect(ev.defaultPrevented).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    expect(window.scrollTo).toHaveBeenCalled();
  });

  it('Scenario: Zurück-Taste (popstate) stellt die vorige Seite wieder her', async () => {
    const { initRouter } = await fresh();
    initRouter();
    click(document.getElementById('to-vision'));
    await vi.waitFor(() => expect(location.pathname).toBe('/pages/vision/'));

    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, text: async () => PAGE('Landing again', 'Back home') }));
    window.history.replaceState({ scroll: 120 }, '', '/pages/landing/');
    window.dispatchEvent(new PopStateEvent('popstate', { state: { scroll: 120 } }));
    await vi.waitFor(() => expect(document.querySelector('main h1').textContent).toBe('Back home'));
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 120);
  });
});
