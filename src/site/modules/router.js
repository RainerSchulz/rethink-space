/**
 * Seitenwechsel ohne Neuladen: holt /pages/<name>/ per fetch, tauscht nur
 * <main> und die Kopfdaten — Header und Footer bleiben stehen, der Inhalt
 * blendet über. Fällt bei Fehlern auf normale Navigation zurück, damit jede
 * Seite auch ohne dieses Modul erreichbar bleibt (Progressive Enhancement).
 */
export const PAGE_EVENT = 'rethink:pagechange';

// Kopfdaten, die je Seite verschieden sind und mitwechseln müssen.
const HEAD_SYNC = 'title, meta[name="description"], meta[name="robots"], link[rel="canonical"], meta[property^="og:"]';
const FADE_MS = 160;
const cache = new Map();

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Interne Seiten-URL eines Links, sonst null (extern, Download, neues Fenster). */
export function internalUrl(a) {
  if (!a || a.target || a.hasAttribute('download')) return null;
  const url = new URL(a.getAttribute('href'), location.href);
  if (url.origin !== location.origin || !url.pathname.startsWith('/pages/')) return null;
  return url;
}

export async function fetchPage(url) {
  const key = url.pathname;
  if (cache.has(key)) return cache.get(key);
  const res = await fetch(key, { headers: { Accept: 'text/html' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
  if (!doc.querySelector('main')) throw new Error('Antwort ohne <main>');
  cache.set(key, doc);
  return doc;
}

function syncHead(doc) {
  document.head.querySelectorAll(HEAD_SYNC).forEach((el) => el.remove());
  doc.head.querySelectorAll(HEAD_SYNC).forEach((el) => document.head.append(document.importNode(el, true)));
}

function swap(doc, scroll) {
  const next = document.importNode(doc.querySelector('main'), true);
  document.querySelector('main').replaceWith(next);
  syncHead(doc);
  window.scrollTo(0, scroll);
  return next;
}

async function transition(doc, scroll) {
  if (reduceMotion()) { swap(doc, scroll); return; }
  if (document.startViewTransition) {
    await document.startViewTransition(() => { swap(doc, scroll); }).finished;
    return;
  }
  // Fallback ohne View Transitions: ausblenden, tauschen, einblenden.
  document.querySelector('main').classList.add('is-leaving');
  await new Promise((r) => setTimeout(r, FADE_MS));
  const next = swap(doc, scroll);
  next.classList.add('is-entering');
  requestAnimationFrame(() => next.classList.remove('is-entering'));
}

export async function navigate(url, { push = true, scroll = 0 } = {}) {
  let doc;
  try {
    doc = await fetchPage(url);
  } catch {
    location.href = url.href;
    return;
  }
  if (push) {
    history.replaceState({ scroll: window.scrollY }, '');
    history.pushState({ scroll: 0 }, '', url.pathname + url.hash);
  }
  await transition(doc, scroll);
  window.dispatchEvent(new CustomEvent(PAGE_EVENT, { detail: { path: url.pathname } }));
}

export function initRouter() {
  if (!('fetch' in window) || !('pushState' in history)) return;
  history.replaceState({ scroll: window.scrollY }, '');

  document.addEventListener('click', (ev) => {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    const url = internalUrl(ev.target.closest('a[href]'));
    if (!url) return;
    if (url.pathname === location.pathname) {
      if (url.hash) return; // Sprungmarke auf derselben Seite: Browser übernimmt
      ev.preventDefault();
      window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
      return;
    }
    ev.preventDefault();
    navigate(url);
  });

  // Vorladen beim Überfahren: der Klick trifft dann auf den Cache.
  document.addEventListener('mouseover', (ev) => {
    const url = internalUrl(ev.target.closest('a[href]'));
    if (url && url.pathname !== location.pathname) fetchPage(url).catch(() => {});
  });

  window.addEventListener('popstate', (ev) => {
    navigate(new URL(location.href), { push: false, scroll: ev.state?.scroll ?? 0 });
  });
}
