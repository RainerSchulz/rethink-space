/**
 * Zugangsschutz für die Testphase (Anmeldemaske vor der Website).
 * Aktiv, sobald VITE_GATE_HASH gesetzt ist (SHA-256 von "e-mail:passwort");
 * ohne die Variable bleibt die Seite offen — so entfällt der Schutz zum
 * Livegang ohne Codeänderung.
 *
 * Wichtig: Das ist ein Sichtschutz, keine echte Zugangskontrolle. Die Seite
 * liegt weiterhin statisch auf dem Server; wer die Dateien direkt abruft,
 * sieht die Inhalte. Für die Testphase genügt das, für echten Schutz braucht
 * es einen Server (Basic Auth) oder einen Dienst wie Cloudflare Access.
 */
import { t, LANG_EVENT } from '../i18n/index.js';

const STORAGE_KEY = 'rethink_gate';
const LOCKED_CLASS = 'is-locked';

/** Erwarteter Prüfwert aus dem Build; leer = kein Schutz. */
export function gateHash() {
  return (window.RETHINK_GATE_HASH ?? import.meta.env.VITE_GATE_HASH ?? '').trim().toLowerCase();
}

/** SHA-256 als Hex; ohne Web Crypto (alte Browser, http) gibt es keinen Schutz. */
export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function unlocked(hash) {
  try { return localStorage.getItem(STORAGE_KEY) === hash; } catch { return false; }
}

function remember(hash) {
  try { localStorage.setItem(STORAGE_KEY, hash); } catch { /* Storage gesperrt: gilt nur für diesen Besuch */ }
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
}

function field({ type, id, key, label: text, autocomplete }) {
  const label = el('label', 'field');
  const span = el('span', null, text);
  span.dataset.i18n = key;
  const input = el('input');
  input.type = type;
  input.id = id;
  input.name = type === 'email' ? 'email' : 'password';
  input.autocomplete = autocomplete;
  input.required = true;
  label.append(span, input);
  return { label, input };
}

function build(expected, onOpen) {
  const gate = el('div', 'site-gate');
  gate.setAttribute('role', 'dialog');
  gate.setAttribute('aria-modal', 'true');
  gate.setAttribute('aria-labelledby', 'gate-title');

  const form = el('form', 'gate-box');
  const logo = el('p', 'gate-logo');
  logo.append(el('span', null, 'RE-THINK'), el('span', 'accent', 'SPACE'));
  const title = el('h1', 'gate-title', t('gate.title'));
  title.id = 'gate-title';
  title.dataset.i18n = 'gate.title';
  const intro = el('p', 'gate-intro', t('gate.intro'));
  intro.dataset.i18n = 'gate.intro';

  const mail = field({ type: 'email', id: 'gate-email', key: 'gate.email', label: t('gate.email'), autocomplete: 'username' });
  const pass = field({ type: 'password', id: 'gate-password', key: 'gate.password', label: t('gate.password'), autocomplete: 'current-password' });

  const error = el('p', 'gate-error', t('gate.error'));
  error.dataset.i18n = 'gate.error';
  error.setAttribute('role', 'alert');
  error.hidden = true;

  const submit = el('button', 'btn gate-submit', t('gate.submit'));
  submit.type = 'submit';
  submit.dataset.i18n = 'gate.submit';

  const note = el('p', 'gate-note', t('gate.note'));
  note.dataset.i18n = 'gate.note';

  form.append(logo, title, intro, mail.label, pass.label, error, submit, note);
  gate.append(form);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    submit.disabled = true;
    let hash = '';
    try {
      hash = await sha256(`${mail.input.value.trim().toLowerCase()}:${pass.input.value}`);
    } catch { /* kein Web Crypto: Anmeldung schlägt fehl */ }
    submit.disabled = false;
    if (hash !== expected) {
      error.hidden = false;
      pass.input.value = '';
      pass.input.focus();
      return;
    }
    remember(hash);
    onOpen(gate);
  });

  window.addEventListener(LANG_EVENT, () => {
    gate.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
  });

  return { gate, firstInput: mail.input };
}

/**
 * Muss als erstes Modul laufen. Gibt true zurück, wenn die Seite offen ist
 * (kein Schutz oder bereits angemeldet).
 */
export function initGate() {
  const expected = gateHash();
  if (!expected) return true;
  if (unlocked(expected)) return true;

  const root = document.documentElement;
  root.classList.add(LOCKED_CLASS);
  const open = (gate) => { gate.remove(); root.classList.remove(LOCKED_CLASS); };
  const { gate, firstInput } = build(expected, open);
  document.body.append(gate);
  firstInput.focus();
  return false;
}
