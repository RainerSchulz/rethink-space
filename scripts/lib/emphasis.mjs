/**
 * Fett (**…**) und Kursiv (*…*) gelten in formatierten Texten nur innerhalb einer Zeile bzw. eines Absatzes (rich-text.js).
 * Der frühere Fett-Knopf setzte die Zeichen um mehrere Absätze — dann blieben die Sternchen sichtbar stehen
 * (Inhaber 23.11.2026, Unterzeile der Startseite). repairEmphasis setzt sie je Zeile; richtiger Text bleibt unverändert.
 *
 * WORTGLEICH in rethink-cms src/emphasis.js und rethink-space scripts/lib/emphasis.mjs —
 * tests/unit/rich-bold-lines.test.js im CMS vergleicht beide Dateien.
 */

/** Jede nicht leere Zeile einzeln umschließen; ein Aufzählungszeichen „- “ bleibt davor. */
export function wrapLines(text, before, after) {
  return text.split('\n').map((line) => {
    const m = /^(\s*(?:- )?)(.*?)(\s*)$/.exec(line);
    return m[2] ? `${m[1]}${before}${m[2]}${after}${m[3]}` : line;
  }).join('\n');
}

/** Fett/Kursiv, das über eine Zeile hinausgeht, je Zeile setzen. */
export function repairEmphasis(text) {
  return String(text ?? '')
    .replace(/(?<![\\*])\*\*(?!\s)([^*]*?\n[^*]*?)(?<!\s)\*\*(?!\*)/g, (all, inner) => wrapLines(inner, '**', '**'))
    .replace(/(?<![\\*])\*(?![\s*])([^*]*?\n[^*]*?)(?<![\s*])\*(?!\*)/g, (all, inner) => wrapLines(inner, '*', '*'));
}
