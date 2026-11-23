/**
 * Feature: Listen, die das CMS verwaltet (scripts/lib/lists.mjs) — People: Publikationen.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findLists, applyLists, renderItem } from '../../scripts/lib/lists.mjs';
import { setRows } from '../../scripts/lib/apply.mjs';

const people = readFileSync(resolve(process.cwd(), 'pages/people/index.html'), 'utf8');
const NAME = 'people.books';
const ids = (html) => findLists(html).find((l) => l.name === NAME).items.map((i) => i.id);

const PAGE = [
  '<ul class="books">',
  '  <!-- cms:list people.books -->',
  '  <li data-cms-row="people.books.1.title" hidden><div class="book"><span class="t" data-i18n="people.books.1.title" lang="de">Eins</span><span class="m" data-i18n="people.books.1.meta">M1</span></div></li>',
  '  <li data-cms-row="people.books.2.title"><div class="book"><span class="t" data-i18n="people.books.2.title">Zwei</span><span class="m" data-i18n="people.books.2.meta">M2</span></div></li>',
  '  <!-- /cms:list -->',
  '</ul>',
].join('\n');

describe('Feature: Listen im CMS (cms:list)', () => {
  it('die People-Seite hat die Publikationen als Liste, je Eintrag Titel und Angaben', () => {
    const lists = findLists(people);
    expect(lists.map((l) => l.name)).toEqual([NAME]);
    const [list] = lists;
    expect(list.items.length).toBeGreaterThanOrEqual(1);
    for (const it of list.items) {
      expect(it.fields).toEqual(['title', 'meta']);
      expect(it.line, 'Zeile ausblendbar über den Titel-Schlüssel').toContain(`data-cms-row="${NAME}.${it.id}.title"`);
    }
  });

  it('Reihenfolge ändern: Einträge behalten ihr Markup (auch hidden und lang)', () => {
    const r = applyLists(PAGE, { [NAME]: [{ id: '2' }, { id: '1' }] });
    expect(ids(r.html)).toEqual(['2', '1']);
    expect(r.html).toContain('<li data-cms-row="people.books.1.title" hidden>');
    expect(r.html).toContain('lang="de">Eins<');
    expect(r.added).toEqual([]);
    expect(r.removed).toEqual([]);
  });

  it('neuer Eintrag aus der Vorlage: eigene Schlüssel und Texte, sichtbar, ohne lang, Text maskiert', () => {
    const text = (k) => ({ 'people.books.neu.title': 'A <b> & $1', 'people.books.neu.meta': 'Verlag, 2026' })[k];
    const r = applyLists(PAGE, { [NAME]: [{ id: '1' }, { id: '2' }, { id: 'neu' }] }, text);
    expect(ids(r.html)).toEqual(['1', '2', 'neu']);
    const line = findLists(r.html)[0].items[2].line;
    expect(line).toContain('<li data-cms-row="people.books.neu.title"><div class="book">');
    expect(line).toContain('data-i18n="people.books.neu.title">A &lt;b&gt; &amp; $1</span>');
    expect(line).toContain('data-i18n="people.books.neu.meta">Verlag, 2026</span>');
    expect(line).not.toMatch(/hidden|lang=|people\.books\.1\./);
    expect(r.added).toEqual([{ name: NAME, id: 'neu', keys: ['people.books.neu.title', 'people.books.neu.meta'] }]);
  });

  it('löschen nennt die Schlüssel (für die Wörterbücher), zweimal anwenden ändert nichts', () => {
    const r = applyLists(PAGE, { [NAME]: [{ id: '2' }] });
    expect(ids(r.html)).toEqual(['2']);
    expect(r.removed).toEqual([{ name: NAME, id: '1', keys: ['people.books.1.title', 'people.books.1.meta'] }]);
    expect(applyLists(r.html, { [NAME]: [{ id: '2' }] }).changed).toBe(false);
  });

  it('ohne Angabe im Export bleibt die Liste; ungültige Kennungen werden übersprungen', () => {
    expect(applyLists(PAGE, {}).changed).toBe(false);
    expect(applyLists(PAGE, undefined).changed).toBe(false);
    const r = applyLists(PAGE, { [NAME]: [{ id: '1' }, { id: 'Böse"><script>' }, { id: '2' }] });
    expect(ids(r.html)).toEqual(['1', '2']);
    expect(r.notes).toHaveLength(1);
    expect(r.html).not.toContain('<script>');
  });

  it('ein neuer Eintrag lässt sich danach wie jeder andere ausblenden (setRows)', () => {
    const line = renderItem(NAME, findLists(PAGE)[0].items[0], 'neu', () => 'X');
    expect(setRows(line, [{ key: 'people.books.neu.title', hidden: true }]).html).toContain('<li data-cms-row="people.books.neu.title" hidden>');
  });
});

describe('Feature: Geschäftsbereiche der Kontaktseite (Liste contact.areas)', () => {
  const contact = readFileSync(resolve(process.cwd(), 'pages/contact/index.html'), 'utf8');

  it('die Kontaktseite hat die Liste mit drei Bereichen, Feld „label“', () => {
    const list = findLists(contact).find((l) => l.name === 'contact.areas');
    expect(list.items.map((i) => i.id)).toEqual(['isru', 'data-centers', 'defense']);
    expect(list.items[0].fields).toEqual(['label']);
  });

  it('neuer Bereich aus der Vorlage: eigene Kennung in Schlüssel, Wert und Zeile, sichtbar, eigener Text', () => {
    const list = findLists(contact).find((l) => l.name === 'contact.areas');
    const hiddenTemplate = { ...list.items[0], line: list.items[0].line.replace('<label class="area"', '<label class="area" hidden') };
    const line = renderItem('contact.areas', hiddenTemplate, 'mining', () => 'Lunar Mining');
    expect(line).toContain('data-cms-row="contact.areas.mining.label"');
    expect(line).toContain('value="contact.areas.mining.label"');
    expect(line).toContain('<span data-i18n="contact.areas.mining.label">Lunar Mining</span>');
    expect(line).not.toMatch(/\shidden/);
  });

  it('umsortieren, löschen und ausblenden wie bei den Publikationen', () => {
    const r = applyLists(contact, { 'contact.areas': [{ id: 'defense' }, { id: 'isru' }] }, () => undefined);
    const ids2 = findLists(r.html).find((l) => l.name === 'contact.areas').items.map((i) => i.id);
    expect(ids2).toEqual(['defense', 'isru']);
    expect(setRows(contact, [{ key: 'contact.areas.defense.label', hidden: true }]).html)
      .toContain('<label class="area" data-cms-row="contact.areas.defense.label" hidden>');
  });
});