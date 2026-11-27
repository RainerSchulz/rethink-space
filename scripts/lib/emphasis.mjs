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

/** Runde Klammern und Leerzeichen in einer Link-Adresse so schreiben, dass die Schreibweise [Text](Adresse) hält. */
export const encodeHref = (href) => String(href ?? '').trim().replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/ /g, '%20');

/**
 * Links reparieren, deren Adresse runde Klammern enthält (Inhaber 27.11.2026, WIPO-Adresse „…AND%20(HOL~…)…“):
 * [Text](https://…(…)…) brach an der ersten „)“ ab, der Rest der Adresse stand sichtbar im Text. Die Klammern in der
 * Adresse werden %28/%29 — dieselbe Adresse für den Browser. Leerraum zwischen „]“ und „(“ fällt weg.
 */
export function repairLinks(text) {
  const s = String(text ?? '');
  const re = /(?<!\\)\[((?:\\.|[^\]\n\\])+)\][ \t]*\((?=https:\/\/|mailto:|\/)/g;
  let out = '';
  let last = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    let depth = 1;
    let i = re.lastIndex;
    for (; i < s.length && depth; i += 1) {
      const c = s[i];
      if (c === '\n' || c === ' ' || c === '\t') break;
      if (c === '(') depth += 1;
      else if (c === ')') depth -= 1;
    }
    if (depth) continue; // keine schließende Klammer — Text bleibt, wie er ist
    const href = s.slice(re.lastIndex, i - 1);
    out += `${s.slice(last, m.index)}[${m[1]}](${encodeHref(href)})`;
    last = i;
    re.lastIndex = i;
  }
  return out + s.slice(last);
}

/** Fett/Kursiv, das über eine Zeile hinausgeht, je Zeile setzen; Links mit Klammern in der Adresse reparieren. */
export function repairEmphasis(text) {
  return repairLinks(text)
    .replace(/(?<![\\*])\*\*(?!\s)([^*]*?\n[^*]*?)(?<!\s)\*\*(?!\*)/g, (all, inner) => wrapLines(inner, '**', '**'))
    .replace(/(?<![\\*])\*(?![\s*])([^*]*?\n[^*]*?)(?<![\s*])\*(?!\*)/g, (all, inner) => wrapLines(inner, '*', '*'));
}
