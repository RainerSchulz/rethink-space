# RETHINK SPACE — Coding Guide

**Version:** 1.1 · September 2026
**Gilt für:** das gesamte Repo — alle Seiten, alle Module
**Abgeleitet aus:** FORGE Portal Coding Guide (forge-portal-vite), reduziert auf das, was für eine statische Website gilt.
**PFLICHT:** Diesen Guide VOR jeder Änderung und VOR jeder Neuerstellung lesen.

---

## ⚡ REGEL #1 — Keine monolithischen Dateien

> **Eine HTML-Datei enthält NUR Markup und Kopfdaten — niemals CSS oder JavaScript.**

| Verboten in `pages/*/index.html` | Stattdessen |
|---|---|
| `<style>…</style>` | `src/site/site.css` |
| `style="…"` | Klasse in `site.css` (z. B. `.note`, `.btn-row`, `.grid.wide`) |
| `<script>…</script>`, `onclick="…"` | Modul in `src/site/modules/` |
| `<link href="https://fonts.googleapis.com…">` | `src/site/fonts.css` (fontsource, selbst gehostet) |

Erlaubt sind genau: `<link rel="stylesheet" href="/src/site/site.css">` (im Head, **vor** dem Script), der Vite-Entry `<script type="module" src="/src/site/main.js"></script>` und `<script type="application/ld+json">` (strukturierte Daten, kein Code).
Das CSS wird bewusst **nicht** aus `main.js` importiert: im Dev-Server käme es sonst erst per JS und die Seite blitzt ohne Stile auf.
`tests/unit/html-shell.test.js` erzwingt das.

---

## ⚡ REGEL #2 — Datei-Struktur (Muster B: Vite-Modul-Seite, wie FORGE)

```
/
├── index.html                   ← DIE STARTSEITE (Wurzel, Adresse rethink.space/)
├── vite.pages.js                ← Seitenliste für den Build
├── pages/<name>/index.html      ← eine Shell je Seite (< 300 Zeilen)
├── public/
│   ├── Bilder/                  ← Bilder, unverändert kopiert, Referenz /Bilder/…
│   ├── favicon.svg, icon-*.png, apple-touch-icon.png, og-image.jpg
│   └── robots.txt, sitemap.xml, site.webmanifest
├── src/site/
│   ├── main.js                  ← Vite-Entry: importiert CSS + startet Module
│   ├── site.css                 ← Alle Stile (Variablen in :root)
│   ├── fonts.css                ← Schrift-Imports
│   ├── i18n/                    ← index.js (t, setLang, applyLang), de.js, en.js
│   └── modules/                 ← router.js, nav.js, contact.js, portrait.js,
│                                   bands.js, chat.js, gate.js
├── scripts/                     ← apply-content.mjs (CMS-Rückweg), lib/apply.mjs,
│                                   build-knowledge.mjs, push-knowledge.mjs
├── deploy/nginx.conf, Dockerfile
└── tests/unit/, tests/e2e/
```

- **Im Root liegt keine zweite HTML-Datei.** Jede Seite ist ein Ordner unter `pages/` mit genau einer `index.html` (kein `css/`, kein `js/`).
- **Links sind absolut:** `/pages/<name>/` (mit Schrägstrich). Die Site läuft im Domain-Root (`base: '/'`).
- **Alles ist englisch — Adressen, Beschriftungen, Namespaces.** Die früher deutschen Adressen sind umbenannt: `kontakt` → `contact`, `autor` → `people`, `impressum` → `legal-notice`, `datenschutz` → `privacy`, `vision` → `lunar-habitato`. Eine Adresse, die nicht so heißt wie der Menüpunkt, ist ein Fehler.

---

## ⚡ REGEL #3 — Ein Modul, eine Verantwortung

- Jede JS-Datei hat genau **eine** Aufgabe und exportiert eine `init…()`-Funktion.
- **Maximal 200 Zeilen** pro Modul. Ausnahme: die Wörterbücher `de.js` / `en.js`.
- Neue Module in `main.js` importieren und dort starten — nirgends sonst.
- Module kommunizieren über Ereignisse (`rethink:langchange`, `rethink:pagechange`), nicht über globale Variablen.
- **Seitenwechsel:** `router.js` tauscht bei internen Links nur `<main>` und die Kopfdaten. Ein Modul, das Elemente aus `<main>` braucht, gehört in `initPage()` in `main.js` — es läuft dann nach jedem Wechsel erneut. Module, die nur Header/Footer betreffen (Navigation), laufen einmal und nutzen Event-Delegation auf `document`. `bands.js` hängt seinen Klick-Horcher **nur einmal** an (Merker am `document`) — ein zweiter Aufruf würde sonst jeden Klick doppelt schalten, der Bereich bliebe zu.

---

## ⚡ REGEL #4 — CSS-Organisation

Reihenfolge in `site.css`: Variablen → Reset → Layout → Header → Buttons → Hero → Karten → Split → Autor → Kontakt → CTA → Rechtliches → Footer → Responsive.

- Farben, Abstände, Radien **immer** aus `:root`-Variablen.
- Aktiver Nav-Link über `[aria-current="page"]`, nicht über eine Klasse.
- Sichtbarkeit über das `hidden`-Attribut, nicht über `style.display`.

---

## ⚡ REGEL #5 — Übersetzungen (i18n) — PFLICHT bei jedem Text

> **Kein sichtbarer Text ohne `data-i18n`-Schlüssel. Kein Schlüssel ohne DE **und** EN.**

```html
<!-- ✓ Korrekt -->
<h2 data-i18n="habitat.road.title">From study to structure.</h2>
<meta name="description" data-i18n-content="habitat.meta.description" content="…">
<button aria-label="Menu" data-i18n-aria-label="nav.menu">

<!-- ✗ VERBOTEN -->
<h2>From study to structure.</h2>
<span class="de">…</span><span class="en">…</span>
```

- **Die Seite ist einsprachig Englisch.** Es gibt keinen DE/EN-Schalter mehr; `detectInitialLang()` liefert fest `'en'` und ignoriert eine früher gespeicherte Wahl — sonst hinge ein Besucher ohne Schalter dauerhaft auf Deutsch fest. Der Text im HTML ist der **englische Fallback** und muss dem EN-Wert exakt entsprechen (Test). `<html lang="en">`, `og:locale` en_US.
- **`de.js` bleibt trotzdem gepflegt**, damit die zweite Sprache ohne Umbau zurückkommen kann (Schalter ins Markup, `detectInitialLang()` zurücksetzen). Der Paritätstest hält beide Wörterbücher in Deckung; fehlt ein deutscher Text, schreibt `content:apply` den englischen hinein.
- Schlüssel-Format: `namespace.bereich.detail`, nur Kleinbuchstaben, Ziffern, `-` und `.`.
- Namespaces (Stand 25.09.2026): `nav`, `footer`, `common`, `home`, `habitat` (Lunar Habitato), `dual` (Dual Use), `people` (Bänder der People-Seite), `contact`, `legal`, `imprint`, `privacy`, `notfound`, `chat`, `gate`.
- Nicht übersetzen: Markenname RETHINK SPACE, Eigennamen, Buchtitel, Zahlen mit Einheit, Daten, E-Mail-Adressen.
- Ein fehlender Schlüssel ist **kein Fehler, sondern ein Text**: `t()` gibt den Schlüssel zurück und er steht blank auf der Seite. Deshalb prüft `tests/unit/i18n.test.js` jeden verwendeten Schlüssel gegen beide Wörterbücher und jeden definierten Schlüssel auf Verwendung.

**Definition of Done für jede Textänderung:** `npm run test:run` grün.

---

## ⚡ REGEL #6 — Kopfdaten jeder Seite (SEO, Sicherheit)

Jede `pages/*/index.html` hat in dieser Reihenfolge:

1. `charset`, `viewport`
2. CSP-Meta (`default-src 'self'` …) und `referrer`
3. `<title data-i18n="<ns>.meta.title">`, `<meta name="description" data-i18n-content="<ns>.meta.description">`
4. `<link rel="canonical" href="https://rethink.space/pages/<name>/">`
5. Open Graph: `og:type`, `og:site_name`, `og:title`, `og:description` (beide `data-i18n-content`), `og:url`, `og:image` (`/og-image.jpg`, 1200×630), `og:locale` + `alternate`, `twitter:card`
6. `theme-color`, Favicon (`/favicon.svg`), `apple-touch-icon`, `manifest`
7. Optional JSON-LD (Landing: Organization + WebSite, Autor: Person)
8. Vite-Entry

Die 404-Seite trägt zusätzlich `<meta name="robots" content="noindex">`. Am einfachsten: Kopf einer bestehenden Seite kopieren und Namespace/Slug ersetzen.

---

## ⚡ REGEL #7 — Bilder

- Alle Bilder in `public/Bilder/`, Referenz als `src="/Bilder/…"`.
- Hero-Hintergründe als `<img class="hero-sub-bg">`, Split-Bilder als `<img>` in `.media` — keine `background-image` im Markup.
- Bilder unterhalb des sichtbaren Bereichs bekommen `loading="lazy"`.
- Das Portrait wird per `data-portrait-src` von `portrait.js` geladen, damit eine fehlende Datei den Build nicht bricht.
- Icons liegen fertig in `public/` (`favicon.svg` ist die Quelle).
- **`og-image.jpg` wird erzeugt, nicht gemalt:** ein Playwright-Lauf gegen den Vorschau-Server rendert die Wortmarke mit der echten Inter der Seite auf 1200 × 630 und misst die Sperrung von `SPACE` im Browser. Ändern sich Name, Claim oder Akzentfarbe, muss das Bild neu erzeugt werden — sonst zeigt jede geteilte Vorschau den alten Stand.

---

## ⚡ REGEL #8 — Kommentare (minimal)

Kommentare erklären das **Warum**, nicht das Was. Datei-Kopf mit einem Satz zur Verantwortung. Keine auskommentierten Code-Reste.

---

## ⚡ REGEL #9 — Vor jeder Änderung prüfen

1. Gibt es die Klasse / das Modul / den Schlüssel schon? (`grep` in `site.css`, `de.js`)
2. Passt die Änderung in ein bestehendes Modul, oder braucht sie ein neues?
3. Betrifft sie Header oder Footer? Dann **alle Seiten** identisch ändern, die Wurzel eingeschlossen (Test vergleicht sie).

---

## ⚡ REGEL #10 — Nach jeder Änderung testen (Pflicht)

```bash
npm run lint        # ESLint
npm run test:run    # Vitest: i18n, Module, HTML-Shell- und SEO-Regeln
npm run build       # Vite-Build muss durchlaufen (dist/404.html entsteht mit)
npm run test:e2e    # Playwright — bei Änderungen an HTML, Navigation, Sprache, Formular
```

| Änderung an … | Mindestens |
|---|---|
| Wörterbuch | `test:run` |
| HTML-Seite | `test:run` + `build` + `test:e2e` |
| CSS | `build` + Sichtprüfung Desktop/Mobil (`npm run dev`) |
| Modul | `lint` + `test:run` + `test:e2e` |

---

## ⚡ REGEL #11 — Neue Seite anlegen (Checkliste)

- [ ] `pages/<name>/index.html`, Kopf/Header/Footer 1:1 von einer bestehenden Seite übernommen, Canonical/OG-URL auf `/pages/<name>/` gesetzt
- [ ] Schlüssel `<ns>.meta.title`, `<ns>.meta.description`, `<ns>.hero.*` in **de.js und en.js**
- [ ] Eintrag in `vite.pages.js`
- [ ] Eintrag in `public/sitemap.xml`
- [ ] Nur wenn die Seite ins Menü soll: Link in der Header-Nav auf **allen** Seiten ergänzt (der Footer hat keine Navigation mehr, und das Menü führt bewusst nur vier Punkte)
- [ ] Seite in `EXPECTED_PAGES` (`tests/unit/html-shell.test.js`) und `PAGES` (`tests/e2e/site.spec.js`) eintragen
- [ ] Im CMS `npm run import`, damit der Editor die neue Seite kennt
- [ ] `npm run test:run && npm run build` grün

---

## ⚡ REGEL #12 — Secrets — NIEMALS im Repo (harter CI-Gate)

Die Pipeline (`.github/workflows/ci.yml`) scannt mit **gitleaks** die gesamte Historie. Findet der Scan ein Secret, gibt es weder Build noch Deploy. Formular-Endpunkte, API-Keys, SMTP-Daten gehören in GitHub Secrets oder auf den Server, nie in HTML oder JS.

---

## ⚡ REGEL #13 — Logo ist IMMER ein Home-Link

`<a class="logo" href="/">` im Header und Footer jeder Seite (Test).

---

## ⚡ REGEL #14 — Barrierefreiheit

- Klickbare Elemente sind `<a href>` oder `<button type="button">` — nie `<div onclick>`.
- Burger: `aria-expanded`, `aria-controls`; Sprachbuttons: `aria-pressed`; aktive Seite: `aria-current="page"`.
- Icon-Links haben ein `aria-label` (übersetzt über `data-i18n-aria-label`); dekorative SVGs `aria-hidden="true"`.
- Escape schließt das Mobilmenü.

---

## ⚡ REGEL #15 — Kacheln sind IMMER klickbar (wie FORGE, Pflicht)

> **Jede Kachel MUSS ein Link sein und auf eine Detailansicht führen — hier: auf die Seite, die das Thema vertieft.**

### Warum
Eine Kachel signalisiert „hier geht es weiter“. Eine Kachel ohne Ziel ist eine Sackgasse: Der Besucher klickt, nichts passiert (FORGE-Regel „KPI-Kacheln immer klickbar + Detail-Ansicht“).

### Muster

```html
<!-- ✓ Korrekt — Link mit Ziel und Pfeil-Label -->
<a class="card" href="/pages/lunar-habitato/">
  <h3 data-i18n="habitat.cards.material.title">Material</h3>
  <p data-i18n="habitat.cards.material.text">…</p>
  <span class="arrow-link" data-i18n="common.more">Learn more</span>
</a>

<!-- ✗ VERBOTEN — Kachel ohne Link -->
<div class="card">
  <h3>Material</h3>
  <p>…</p>
</div>
```

- Ziel ist immer `/pages/<name>/` (Test prüft, dass die Seite existiert). **Stand 25.09.2026 gibt es keine Kachel mehr** — die Stile `.card`/`.card-media`/`.pillar` sind mit den gelöschten Seiten entfallen. Eine neue Kachel bringt ihr CSS also selbst mit.
- **Ausnahme — die Bänder auf `lunar-habitato`, `dual-use` und `people`:** dort ist die Fläche ausdrücklich *kein* Link. Nur der Knopf `.band-toggle` („Learn more") klappt den Bereich `.band-panel` direkt darunter auf, ohne Seitenwechsel (`modules/bands.js`, `aria-expanded` + `aria-controls`). Alle Bereiche tragen `hidden` **schon im Markup**, damit beim Laden nichts aufgeklappt aufblitzt. Deshalb heißen die Klassen `.band*` und nicht `.card`/`.pillar` — so bleibt die Kachelregel für echte Kacheln scharf. Neue Bandseite → `BAND_PAGES` in `html-shell.test.js` und die Schleife im E2E-Block ergänzen.
- Ziel wählen: die Seite, die das Thema am tiefsten behandelt. Seit dem Aufräumen am 25.09.2026 gibt es nur noch die vier Menüseiten plus Impressum, Datenschutz und 404 — eine Kachel braucht also erst ein Ziel, bevor sie entsteht.
- Kein `onclick`, kein `<div>` — die Kachel selbst ist das `<a>` (Tastatur, Screenreader, Router funktionieren dann von allein).
- CSS für eine neue Kachel: `.card:hover` hebt an und färbt den Rand, `.card:hover .arrow-link::after` schiebt den Pfeil, `:focus-visible` zeigt den Fokusring.
- Ohne Ziel keine Kachel-Optik: Listen (z. B. Bücher auf der Autorenseite) sind schlichte Listen mit Trennlinien.
- `tests/unit/html-shell.test.js`: „jede Kachel ist ein Link mit Ziel und Pfeil-Label“.

---

## ⚡ REGEL #16 — Bild- und Kachelgestaltung (Pflicht, ohne Nachfrage anwenden)

> **Jedes Bild füllt seine Fläche vollständig aus, alle Kacheln einer Reihe sind gleich groß, die Wortmarke steht nur im Logo, und der Akzent ist Cyan.**

### Warum
Schwarze Ränder (Letterboxing) und unterschiedlich hohe Kacheln wirken unfertig. Bilder mit eingebranntem „RETHINK“ doppeln das Logo und stören, seit der Hero die Wortmarke nicht mehr zeigt.

### Regeln

```css
/* ✓ Korrekt — feste Fläche, Bild füllt sie */
.band { aspect-ratio: 64 / 15; }
.band-media { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }

/* ✗ VERBOTEN — Bild wird eingepasst, Ränder bleiben schwarz */
.band-media { object-fit: contain; background: #000; }
```

- Betroffen: `.band-media`, `.hero-sub-bg`, `.portrait img`.
- Hochformatige Motive, deren Kopf wichtig ist, bekommen `.band-media--top` bzw. `object-position: top` — im sehr breiten Band schneidet der mittige Ausschnitt sonst den Kopf ab.
- **Motive, die im Rahmen nicht aufgehen, brauchen eine zweite Fassung.** Das Partner-Logoband ist 5:2, die Kachel auf dem Handy 3:2 — der schmale Rahmen schnitt ein Logo ganz und zwei halb weg. Lösung: hochformatige Fassung (`…-hoch.jpg`, Logos im 2×2-Raster, per Canvas im Playwright-Chromium erzeugt), eingebunden per `<picture><source media="(max-width: 820px)">`. Weder `contain` noch ein anderes Seitenverhältnis für eine einzelne Kachel.
- **Bilder ohne Schriftzug:** `2026-09-Re-Think-*` und `2026-09-Re-Dual-Use.jpeg` tragen die eingebrannte Wortmarke und sind in `pages/` gesperrt (`html-shell.test.js`). Die Dateien selbst sind seit dem 25.09.2026 gelöscht (Git-Historie), die Namenssperre bleibt. Neue Varianten ohne Schriftzug als `…-clean.jpg` (zugeschnitten) oder `…-wide.jpg` (Querformat-Ausschnitt) ablegen; Zuschnitt per Canvas im Playwright-Chromium, kein zusätzliches Werkzeug nötig.
- **Unterseiten-Hero:** Inhaltsbreite wie die Überschrift (`min(100% - 48px, var(--maxw) - 48px)`), `aspect-ratio: 16/9`, `object-fit: cover`; `.hero-sub + section` hat verkürztes `padding-top`.
- **Landing-Hero:** nur der Claim (zwei Leitsätze, beide weiß) vor dem Mond — kein Button, keine Kacheln, keine News. Abstand Header → Überschrift und Überschrift → Mondbogen sind **gleich groß** (56 px Desktop, 22 px Tablet, 18 px Handy); wird die Schriftgröße geändert, muss `--moon-top` in allen Breakpoints nachgezogen werden.
- **Bänder:** Überschrift links **unten** im Bild in Schrift und Größe der Startseiten-Überschrift (`.band-h` = `.hero h1`), „Learn more" dicht darunter (2 px). Das erste Band trägt das `<h1>` der Seite, die übrigen `<h2>`. Jedes Band bekommt ein eigenes Motiv — keine zwei Bänder mit demselben Bild.
- **Farbe:** der Akzent ist `#00d9ff` (`--accent`), auf Schwarz 12,4:1. Auf farbigen Flächen ist die Schrift **schwarz** (`--accent-on: #001014`, 12,4:1) — Weiß käme dort nur auf 1,7:1 und fiele durch. Betrifft `.btn`, Skip-Link, `.chat-fab` und die Nutzer-Blase im Chat. Fokusring `#9beaff` (sichtbar auf Schwarz **und** auf der hellen Mondfläche). Kein Orange mehr im Projekt.
- **Wortmarke:** `SPACE` ist per `letter-spacing: .2784em` auf die Breite von `RETHINK` gesperrt — gleiche Schrift, gleiche Größe. Der Wert ist gemessen ((83,9 − 62,8) px auf vier Zwischenräume bei 19 px), nicht geschätzt; `margin-right: -.2784em` nimmt die Sperrung hinter dem letzten Buchstaben zurück, damit der Logo-Block nicht breiter wird als die Schrift.
- **Schmale Geräte:** kein verschenkter Platz — Bänder im Format 3:2 mit Text unten auf der dunklen Hälfte, News-Karten Bild links, Burger-Menü eng.

---

## ⚡ REGEL #17 — Inhalte aus dem CMS (Rückweg)

> **Redaktionelle Texte und Bilder ändert der Inhaber im CMS (`../rethink-cms`, eigenes Repo) — nicht von Hand in `en.js`.**

```bash
# im CMS: Veröffentlichen → Export herunterladen (site-content.json)
npm run content:apply -- "C:/Users/<du>/Downloads/site-content.json"
npm run lint && npm run test:run && npm run build     # danach immer
```

- `scripts/apply-content.mjs` schreibt die Werte nach `en.js`/`de.js`, den englischen Text an **jedes** `data-i18n`-Element und die Bildpfade in den Shells. Die Umformungen stehen in `scripts/lib/apply.mjs` und sind in `tests/unit/apply-content.test.js` geprüft.
- **Titel und Beschreibung stehen je Seite zweimal** (`name="description"` und `og:description`) unter demselben Schlüssel. Wer nur die erste Fundstelle ersetzt, lässt die Open-Graph-Angaben still veralten — deshalb ersetzt der Generator jede Fundstelle, und ein Test hält das fest.
- Das Skript **legt nie neue Schlüssel an**: unbekannte meldet es und geht weiter. Neue Texte entstehen weiter im Code, danach im CMS `npm run import`.
- Passt die Bildanzahl nicht zur Seite, bleibt die Seite unangetastet — lieber nichts tun als Bilder verschieben. (Die Regel, dass `href` und `src` bei Galerie-Bildern gemeinsam wandern, steht weiter im Generator, greift aber erst wieder, wenn es Galerien gibt.)
- Zweimal anwenden ändert nichts mehr (idempotent). Der Generator gegen einen frischen `npm run import` muss **null** Änderungen ergeben; das ist der schnellste Test, ob Import und Rückweg noch zusammenpassen.

---

## ⚡ REGEL #18 — Deployment

- `dist/` läuft im Domain-Root. Docker-Image (`Dockerfile` + `deploy/nginx.conf`) wie FORGE, oder GitHub Pages mit eigener Domain.
- Sicherheits-Header, die im `<meta>` nicht wirken (`X-Frame-Options`, `nosniff`, `frame-ancestors`), setzt `deploy/nginx.conf`.
- Domain-Wechsel = drei Stellen: Canonical/OG in `pages/*/index.html`, `public/sitemap.xml`, `public/robots.txt`.
