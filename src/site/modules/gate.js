/**
 * Zugangsschutz für die Testphase (Anmeldemaske vor der Website).
 * Aktiv, sobald VITE_GATE_HASH gesetzt ist: ein SHA-256 von "e-mail:passwort"
 * oder mehrere, durch Komma getrennt (mehrere Testzugänge oder Schreibweisen).
 * Ohne die Variable bleibt die Seite offen — der Livegang braucht also keine
 * Codeänderung.
 *
 * „Angemeldet bleiben“ entscheidet, wo die Freigabe liegt: localStorage
 * (dauerhaft auf diesem Gerät) oder sessionStorage (nur dieses Browserfenster).
 *
 * Wichtig: Das ist ein Sichtschutz, keine echte Zugangskontrolle. Die Seite
 * liegt weiterhin statisch auf dem Server; wer die Dateien direkt abruft,
 * sieht die Inhalte. Für echten Schutz braucht es einen Server (Basic Auth)
 * oder einen Dienst wie Cloudflare Access.
 */
import { t, LANG_EVENT } from '../i18n/index.js';

const STORAGE_KEY = 'rethink_gate';
const LOCKED_CLASS = 'is-locked';

/** Erlaubte Prüfwerte aus dem Build; leere Liste = kein Schutz. */
export function gateHashes() {
  const raw = window.RETHINK_GATE_HASH ?? import.meta.env.VITE_GATE_HASH ?? '';
  return String(raw).toLowerCase().split(',').map((h) => h.trim()).filter(Boolean);
}

/** SHA-256 als Hex; ohne Web Crypto (alte Browser, http) gibt es keinen Schutz. */
export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function stored() {
  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      const v = store?.getItem(STORAGE_KEY);
      if (v) return v;
    } catch { /* Storage gesperrt */ }
  }
  return null;
}

function remember(hash, forever) {
  try {
    (forever ? localStorage : sessionStorage).setItem(STORAGE_KEY, hash);
    if (!forever) localStorage.removeItem(STORAGE_KEY);
  } catch { /* Storage gesperrt: gilt nur für diesen Besuch */ }
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

function build(allowed, onOpen) {
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

  const keep = el('label', 'gate-keep');
  const keepBox = el('input');
  keepBox.type = 'checkbox';
  keepBox.id = 'gate-remember';
  keepBox.name = 'remember';
  keepBox.checked = true;
  const keepText = el('span', null, t('gate.remember'));
  keepText.dataset.i18n = 'gate.remember';
  keep.append(keepBox, keepText);

  const error = el('p', 'gate-error', t('gate.error'));
  error.dataset.i18n = 'gate.error';
  error.setAttribute('role', 'alert');
  error.hidden = true;

  const submit = el('button', 'btn gate-submit', t('gate.submit'));
  submit.type = 'submit';
  submit.dataset.i18n = 'gate.submit';

  const note = el('p', 'gate-note', t('gate.note'));
  note.dataset.i18n = 'gate.note';

  form.append(logo, title, intro, mail.label, pass.label, keep, error, submit, note);
  gate.append(form);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    submit.disabled = true;
    let hash = '';
    try {
      hash = await sha256(`${mail.input.value.trim().toLowerCase()}:${pass.input.value}`);
    } catch { /* kein Web Crypto: Anmeldung schlägt fehl */ }
    submit.disabled = false;
    if (!allowed.includes(hash)) {
      error.hidden = false;
      pass.input.value = '';
      pass.input.focus();
      return;
    }
    remember(hash, keepBox.checked);
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
  const allowed = gateHashes();
  if (!allowed.length) return true;
  if (allowed.includes(stored())) return true;

  const root = document.documentElement;
  root.classList.add(LOCKED_CLASS);
  const open = (gate) => { gate.remove(); root.classList.remove(LOCKED_CLASS); };
  const { gate, firstInput } = build(allowed, open);
  document.body.append(gate);
  firstInput.focus();
  return false;
}
