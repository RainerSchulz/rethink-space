/**
 * Firmendaten als Platzhalter in Seitentexten (Inhaber 23.11.2026): steht in einem Text etwa {firma_de_adresse}, setzt die
 * Website beim Veröffentlichen die Anschrift der deutschen Firma ein (CMS → „Firma“, cms_settings „company“ = { us, de }).
 * Ändert sich die Anschrift dort, ändert sie sich mit dem nächsten Veröffentlichen überall, wo der Platzhalter steht.
 *
 * Platzhalter: {firma_<us|de>_<feld>} mit feld = name, adresse, telefon, email, website, vertreten, register, steuernummer.
 * Eine Zeile, die nur aus leeren Platzhaltern bestand, fällt weg; unbekannte Platzhalter bleiben sichtbar stehen.
 *
 * WORTGLEICH in rethink-cms src/company-text.js und rethink-space scripts/lib/company-text.mjs —
 * tests/unit/company-text.test.js im CMS vergleicht beide Dateien.
 */

/** Feldname im Platzhalter → Feld der Firmendaten. */
export const COMPANY_TOKENS = {
  name: 'name',
  adresse: 'address',
  telefon: 'phone',
  email: 'email',
  website: 'website',
  vertreten: 'representative',
  register: 'register',
  steuernummer: 'tax_id',
};

const TOKEN = /\{firma_(us|de)_([a-z]+)\}/g;

/** Enthält der Text einen Platzhalter für Firmendaten? */
export function hasCompanyTokens(text) {
  return /\{firma_(us|de)_[a-z]+\}/.test(String(text ?? ''));
}

/** Gespeicherte Firmendaten vereinheitlichen; ein älterer Einzeleintrag gilt als die amerikanische Firma. */
export function companiesOf(value) {
  const v = value && typeof value === 'object' ? value : {};
  const raw = !('us' in v) && !('de' in v) && 'name' in v ? { us: v } : v;
  const one = (c) => Object.fromEntries(Object.values(COMPANY_TOKENS).map((k) => [k, typeof c?.[k] === 'string' ? c[k].trim() : '']));
  return { us: one(raw.us), de: one(raw.de) };
}

/** Platzhalter im Text durch die Firmendaten ersetzen. */
export function fillCompany(text, companies) {
  const s = String(text ?? '');
  if (!hasCompanyTokens(s)) return s;
  const c = companiesOf(companies);
  return s.split('\n').flatMap((line) => {
    let used = false;
    let filled = false;
    const out = line.replace(TOKEN, (all, id, field) => {
      const key = COMPANY_TOKENS[field];
      if (!key) return all;
      used = true;
      if (c[id][key]) filled = true;
      return c[id][key];
    });
    return used && !filled && !out.trim() ? [] : [out];
  }).join('\n');
}
