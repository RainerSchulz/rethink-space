/**
 * Feature: Chat-Widget (modules/chat.js)
 * Ohne Endpoint kein Widget; mit Endpoint: Button, Dialog, Frage per fetch,
 * gestreamte Antwort mit Links, Fehlerfall ohne kaputten Verlauf.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

async function fresh(path) {
  vi.resetModules();
  return import(path);
}

const ENDPOINT = 'https://test.supabase.co/functions/v1/chat';

function sseResponse(events) {
  const enc = new TextEncoder();
  const body = new ReadableStream({
    start(ctrl) {
      for (const e of events) ctrl.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      ctrl.close();
    },
  });
  return { ok: true, status: 200, body };
}

const submit = (q) => {
  const input = document.querySelector('#chat-input');
  input.value = q;
  document.querySelector('.chat-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
};

describe('Feature: Chat-Widget (modules/chat.js)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main><p>Inhalt</p></main>';
    vi.stubEnv('VITE_CHAT_ENDPOINT', '');
    delete window.RETHINK_CHAT_ENDPOINT;
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('Scenario: ohne konfigurierten Endpoint gibt es kein Widget', async () => {
    const { initChat } = await fresh('../../src/site/modules/chat.js');
    expect(initChat()).toBeNull();
    expect(document.querySelector('.chat-fab')).toBeNull();
  });

  it('Scenario: Frage wird gesendet, Antwort gestreamt, Seitenpfade werden Links', async () => {
    window.RETHINK_CHAT_ENDPOINT = ENDPOINT;
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([
      { type: 'text', text: 'ISRU means local resources. ' },
      { type: 'text', text: 'See /pages/space/' },
      { type: 'done' },
    ]));
    vi.stubGlobal('fetch', fetchMock);
    const { initChat } = await fresh('../../src/site/modules/chat.js');
    initChat();

    const fab = document.querySelector('.chat-fab');
    expect(fab.getAttribute('aria-haspopup')).toBe('dialog');
    fab.click();
    const dlg = document.querySelector('dialog.chat');
    expect(dlg.hasAttribute('open')).toBe(true);

    submit('What is ISRU?');
    await vi.waitFor(() => expect(document.querySelector('.chat-msg--assistant .chat-text').textContent).toContain('See'));

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(ENDPOINT);
    expect(JSON.parse(init.body)).toEqual({ lang: 'en', messages: [{ role: 'user', content: 'What is ISRU?' }] });
    expect(document.querySelector('.chat-msg--user .chat-text').textContent).toBe('What is ISRU?');
    expect(document.querySelector('.chat-msg--assistant a[href="/pages/space/"]')).not.toBeNull();
    expect(document.querySelector('.chat-msg--assistant .chat-text').textContent).toBe('ISRU means local resources. See /pages/space/');
  });

  it('Scenario: Fehler zeigt Hinweis; die nächste Frage schickt keinen kaputten Verlauf', async () => {
    window.RETHINK_CHAT_ENDPOINT = ENDPOINT;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, body: null })
      .mockResolvedValueOnce(sseResponse([{ type: 'text', text: 'Fine.' }, { type: 'done' }]));
    vi.stubGlobal('fetch', fetchMock);
    const { initChat } = await fresh('../../src/site/modules/chat.js');
    initChat();
    document.querySelector('.chat-fab').click();

    submit('first');
    await vi.waitFor(() => expect(document.querySelector('.chat-msg--assistant.is-error, .chat-text.is-error')).not.toBeNull());
    expect(document.querySelector('.chat-text.is-error').textContent).toBe('Sorry, something went wrong. Please try again.');

    submit('second');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body.messages).toEqual([{ role: 'user', content: 'second' }]); // „first“ wurde verworfen
  });

  it('Scenario: Escape schließt den Dialog und der Fokus geht zurück auf den Button', async () => {
    window.RETHINK_CHAT_ENDPOINT = ENDPOINT;
    const { initChat } = await fresh('../../src/site/modules/chat.js');
    initChat();
    document.querySelector('.chat-fab').click();
    const dlg = document.querySelector('dialog.chat');
    dlg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(dlg.hasAttribute('open')).toBe(false);
    expect(document.activeElement).toBe(document.querySelector('.chat-fab'));
  });
});
