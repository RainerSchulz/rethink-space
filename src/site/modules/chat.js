/**
 * Chat „Frag RETHINK SPACE“ (Stufe 1).
 * Schwebender Button + <dialog> mit Verlauf. Fragen gehen an die Supabase
 * Edge Function (VITE_CHAT_ENDPOINT), Antworten kommen als SSE-Stream
 * (data: {"type":"text"|"done"|"error"}). Der API-Schlüssel liegt nur in
 * der Funktion, nie im Browser. Ohne konfigurierten Endpoint bleibt das
 * Widget aus; der Rest der Seite hängt nicht davon ab.
 */
import { t, getLang, LANG_EVENT } from '../i18n/index.js';

const MAX_TURNS = 8;     // Frage-Antwort-Paare, die mitgeschickt werden
const MAX_INPUT = 1000;  // Zeichen je Frage
const ICON_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 5h16v11H8l-4 4z"/></svg>';
const ICON_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

const history = [];
let ui = null;

/** Endpoint: Test-Override im Fenster, sonst Build-Variable (öffentliche URL, kein Secret). */
export function chatEndpoint() {
  return window.RETHINK_CHAT_ENDPOINT || import.meta.env.VITE_CHAT_ENDPOINT || '';
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
}

/** Antworttext als DOM: Zeilenumbrüche und Links (/pages/… oder https://…), ohne innerHTML. */
export function renderAnswer(container, text) {
  container.textContent = '';
  const re = /(https?:\/\/[^\s)]+|\/pages\/[a-z0-9-]+\/)/g;
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    let last = 0;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(line))) {
      if (m.index > last) container.append(line.slice(last, m.index));
      const a = el('a', null, m[0]);
      a.href = m[0];
      if (m[0].startsWith('http')) { a.target = '_blank'; a.rel = 'noopener'; }
      container.append(a);
      last = m.index + m[0].length;
    }
    if (last < line.length) container.append(line.slice(last));
    if (i < lines.length - 1) container.append(document.createElement('br'));
  });
}

/** SSE-Stream in Ereignisse zerlegen. */
async function* sseEvents(body) {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data:')) continue;
        try { yield JSON.parse(line.slice(5).trim()); } catch { /* unvollständige Zeile ignorieren */ }
      }
    }
  }
}

function build() {
  const fab = el('button', 'chat-fab');
  fab.type = 'button';
  fab.setAttribute('aria-haspopup', 'dialog');
  fab.setAttribute('aria-label', t('chat.open'));
  fab.innerHTML = ICON_CHAT;
  const fabLabel = el('span', 'chat-fab-label', t('chat.label'));
  fab.append(fabLabel);

  const dlg = el('dialog', 'chat');
  dlg.setAttribute('aria-label', t('chat.title'));
  const head = el('div', 'chat-head');
  const title = el('h2', 'chat-title', t('chat.title'));
  const close = el('button', 'chat-close');
  close.type = 'button';
  close.setAttribute('aria-label', t('chat.close'));
  close.innerHTML = ICON_CLOSE;
  head.append(title, close);
  const intro = el('p', 'chat-intro', t('chat.intro'));
  const log = el('div', 'chat-log');
  log.setAttribute('role', 'log');
  log.setAttribute('aria-live', 'polite');
  const form = el('form', 'chat-form');
  const label = el('label', 'sr-only', t('chat.placeholder'));
  label.htmlFor = 'chat-input';
  const input = el('textarea');
  input.id = 'chat-input';
  input.rows = 2;
  input.maxLength = MAX_INPUT;
  input.required = true;
  input.placeholder = t('chat.placeholder');
  const send = el('button', 'btn chat-send', t('chat.send'));
  send.type = 'submit';
  form.append(label, input, send);
  const hint = el('p', 'chat-hint', t('chat.hint'));
  dlg.append(head, intro, log, form, hint);
  document.body.append(fab, dlg);

  const open = () => { if (!dlg.open) dlg.show(); input.focus(); };
  const shut = () => { dlg.close(); fab.focus(); };
  fab.addEventListener('click', open);
  close.addEventListener('click', shut);
  dlg.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { ev.preventDefault(); shut(); } });
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); }
  });
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const q = input.value.trim();
    if (!q || send.disabled) return;
    input.value = '';
    ask(q);
  });

  window.addEventListener(LANG_EVENT, () => {
    fab.setAttribute('aria-label', t('chat.open'));
    fabLabel.textContent = t('chat.label');
    dlg.setAttribute('aria-label', t('chat.title'));
    title.textContent = t('chat.title');
    close.setAttribute('aria-label', t('chat.close'));
    intro.textContent = t('chat.intro');
    label.textContent = t('chat.placeholder');
    input.placeholder = t('chat.placeholder');
    send.textContent = t('chat.send');
    hint.textContent = t('chat.hint');
  });

  return { fab, dlg, log, input, send };
}

function addMessage(role, text) {
  const msg = el('div', `chat-msg chat-msg--${role}`);
  msg.append(el('span', 'chat-who', role === 'user' ? t('chat.you') : t('chat.bot')));
  const body = el('div', 'chat-text', text);
  msg.append(body);
  ui.log.append(msg);
  ui.log.scrollTop = ui.log.scrollHeight;
  return body;
}

/**
 * Steht die Antwort ganz da, den Anfang nach oben holen.
 * Waehrend des Streamens haengt die Ansicht am Ende, damit man den Text
 * kommen sieht. Ist er fertig, will man ihn von vorn lesen und nicht erst
 * zurueckscrollen. Bei einer kurzen Antwort begrenzt der Browser den Wert
 * von allein, dann bleibt alles sichtbar.
 */
function zeigeAntwortanfang(body) {
  const msg = body.closest('.chat-msg');
  if (!msg) return;
  ui.log.scrollTop += msg.getBoundingClientRect().top - ui.log.getBoundingClientRect().top;
}

async function ask(question) {
  addMessage('user', question);
  history.push({ role: 'user', content: question });
  const pending = addMessage('assistant', t('chat.thinking'));
  pending.classList.add('is-pending');
  ui.send.disabled = true;
  let answer = '';
  try {
    const res = await fetch(chatEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: getLang(), messages: history.slice(-MAX_TURNS * 2) }),
    });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    for await (const ev of sseEvents(res.body)) {
      if (ev.type === 'text') {
        answer += ev.text;
        pending.classList.remove('is-pending');
        renderAnswer(pending, answer);
        ui.log.scrollTop = ui.log.scrollHeight;
      } else if (ev.type === 'error') {
        throw new Error(ev.message || 'upstream');
      }
    }
    if (!answer) throw new Error('empty');
    history.push({ role: 'assistant', content: answer });
    zeigeAntwortanfang(pending);
  } catch {
    history.pop(); // Frage wieder entfernen, damit der Verlauf abwechselnd bleibt
    pending.classList.remove('is-pending');
    pending.classList.add('is-error');
    pending.textContent = t('chat.error');
  } finally {
    ui.send.disabled = false;
    ui.input.focus();
  }
}

/** Einmal beim Start aufrufen; das Widget lebt außerhalb von <main> und überlebt Seitenwechsel. */
export function initChat() {
  if (ui || !chatEndpoint()) return null;
  ui = build();
  return ui;
}
