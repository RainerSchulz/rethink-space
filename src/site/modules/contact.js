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

/**
 * Geschäftsbereiche frisch aus dem CMS einsetzen (Inhaber 23.11.2026: Änderungen unter „Einstellungen“ gelten
 * sofort, ohne Veröffentlichen). Vorlage ist der erste Eintrag aus dem HTML; die Texte kommen nur per textContent.
 * Ohne Antwort oder bei einer leeren Liste bleibt die Auswahl aus dem HTML stehen.
 * @param {HTMLFormElement} form
 * @param {{ legend?: string, areas?: { id: string, label: string }[] }} data
 * @returns {boolean} ob die Auswahl ersetzt wurde
 */
export function renderAreas(form, data) {
  const set = form.querySelector('fieldset.areas');
  const old = [...(set?.querySelectorAll('label.area') ?? [])];
  const areas = (Array.isArray(data?.areas) ? data.areas : [])
    .filter((a) => /^[a-z0-9-]+$/.test(a?.id ?? '') && typeof a.label === 'string' && a.label.trim());
  if (!set || !old.length || !areas.length) return false;
  const chosen = set.querySelector('input[name="area"]:checked')?.value;
  const anchor = old.at(-1).nextSibling;
  const parent = old[0].parentNode;
  const fresh = areas.map(({ id, label }) => {
    const key = `contact.areas.${id}.label`;
    const row = old[0].cloneNode(true);
    row.hidden = false;
    row.removeAttribute('hidden');
    row.setAttribute('data-cms-row', key);
    const input = row.querySelector('input');
    input.value = key;
    input.checked = key === chosen;
    const span = row.querySelector('span');
    span.removeAttribute('data-i18n'); // sonst setzte die Übersetzung beim Sprachwechsel den alten Stand
    span.textContent = label.trim();
    return row;
  });
  old.forEach((row) => row.remove());
  fresh.forEach((row) => parent.insertBefore(row, anchor));
  const legend = set.querySelector('legend');
  if (legend && typeof data.legend === 'string' && data.legend.trim()) {
    legend.removeAttribute('data-i18n');
    legend.textContent = data.legend.trim();
  }
  return true;
}

/** Auswahl beim Öffnen der Seite laden (GET an dieselbe Funktion wie das Absenden). */
export async function loadAreas(form, endpoint = contactEndpoint()) {
  if (!endpoint || !form.querySelector('fieldset.areas')) return false;
  try {
    const res = await fetch(endpoint, { method: 'GET' });
    if (!res.ok) return false;
    return renderAreas(form, await res.json());
  } catch {
    return false; // die Auswahl aus dem HTML gilt weiter
  }
}

export function initContact() {
  const form = document.querySelector('form[data-contact]');
  if (!form) return;
  loadAreas(form);

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
          // Geschäftsbereich (optional): die sichtbare Bezeichnung, nicht der Schlüssel — so steht sie lesbar in der Anfrage
          area: form.querySelector('input[name="area"]:checked')?.closest('label')?.textContent.trim() ?? '',
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
