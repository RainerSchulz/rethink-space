/**
 * Kontaktformular (form[data-contact]).
 *
 * Schickt die Anfrage an die Supabase Edge Function (VITE_CONTACT_ENDPOINT).
 * Ohne Endpoint bleibt das Formular bedienbar, meldet aber ehrlich, dass
 * gerade nichts ankommt, und verweist auf die E-Mail-Adresse — das ist
 * besser als ein „Danke“, hinter dem nichts passiert.
 *
 * Der Hinweis .form-status wird vorgelesen (role="status") und bekommt den
 * Fokus, damit auch am Bildschirmleser ankommt, was passiert ist.
 */
import { t } from '../i18n/index.js';

/** Endpoint: Test-Override im Fenster, sonst Build-Variable (öffentliche URL, kein Secret). */
export function contactEndpoint() {
  return window.RETHINK_CONTACT_ENDPOINT || import.meta.env.VITE_CONTACT_ENDPOINT || '';
}

/** Fehlerschlüssel der Funktion in einen Satz übersetzen. */
function fehlertext(code) {
  if (code === 'rate_limited') return t('contact.form.too-many');
  if (code === 'fields_missing') return t('contact.form.incomplete');
  if (code === 'email_invalid') return t('contact.form.bad-email');
  return t('contact.form.error');
}

function melde(form, text, art) {
  const note = form.querySelector('.form-status');
  if (!note) return;
  note.textContent = text;
  note.dataset.art = art;
  note.hidden = false;
  note.focus();
}

export function initContact() {
  const form = document.querySelector('form[data-contact]');
  if (!form) return;

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const endpoint = contactEndpoint();
    const daten = Object.fromEntries(new FormData(form));

    if (!endpoint) {
      melde(form, t('contact.form.status'), 'hinweis');
      return;
    }

    const knopf = form.querySelector('button[type="submit"]');
    if (knopf) knopf.disabled = true;
    melde(form, t('contact.form.sending'), 'hinweis');

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: daten.name ?? '',
          email: daten.email ?? '',
          message: daten.message ?? '',
          website: daten.website ?? '', // Honigtopf, siehe Markup
        }),
      });
      const antwort = await res.json().catch(() => ({}));
      if (!res.ok) {
        melde(form, fehlertext(antwort.error), 'fehler');
        return;
      }
      form.reset();
      melde(form, t('contact.form.sent'), 'erfolg');
    } catch {
      melde(form, t('contact.form.error'), 'fehler');
    } finally {
      if (knopf) knopf.disabled = false;
    }
  });
}
