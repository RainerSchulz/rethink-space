// Firmendaten als Platzhalter in Seitentexten ({firma_de_adresse} …), gefüllt beim Veröffentlichen (rethink-cms „Firma“)
import { describe, it, expect } from 'vitest';
import { fillCompany, companiesOf } from '../../scripts/lib/company-text.mjs';
import { toSnapshot } from '../../scripts/lib/snapshot.mjs';

const COMPANY = { us: { name: 'RETHINK SPACE Inc.' }, de: { name: 'RETHINK SPACE', address: 'An der Hasenkaule 10\nAI Village Studio 6\n50354 Hürth' } };

describe('Feature: Firmendaten in Seitentexten', () => {
  it('setzt die Anschrift der deutschen Firma ein, mehrzeilig', () => {
    expect(fillCompany('RETHINK SPACE\n{firma_de_adresse}\n\nRest', COMPANY))
      .toBe('RETHINK SPACE\nAn der Hasenkaule 10\nAI Village Studio 6\n50354 Hürth\n\nRest');
  });

  it('leere Angabe: Zeile fällt weg; unbekannte Platzhalter bleiben; Text ohne Platzhalter unverändert', () => {
    expect(fillCompany('A\n{firma_de_telefon}\nB', COMPANY)).toBe('A\nB');
    expect(fillCompany('Tel. {firma_us_telefon}', COMPANY)).toBe('Tel. ');
    expect(fillCompany('{firma_de_hobby}', COMPANY)).toBe('{firma_de_hobby}');
    expect(fillCompany('Kein Platzhalter', null)).toBe('Kein Platzhalter');
    expect(companiesOf({ name: 'Alt Inc.' }).us.name).toBe('Alt Inc.');
  });

  it('der veröffentlichte Stand behält den Platzhalter und vermerkt die Firmendaten', () => {
    const snap = toSnapshot({ company: COMPANY, pages: [{ slug: 'legal-notice', keys: [{ key: 'imprint.operator.body', en: 'X\n{firma_de_adresse}' }] }] });
    expect(snap.pages['legal-notice'].texts['imprint.operator.body'].en).toBe('X\n{firma_de_adresse}');
    expect(snap.company).toEqual(COMPANY);
  });
});
