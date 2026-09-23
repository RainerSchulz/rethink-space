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
├── index.html                   ← NUR Weiterleitung auf /pages/landing/
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
│   └── modules/                 ← nav.js, lang-switch.js, contact.js, portrait.js
├── deploy/nginx.conf, Dockerfile
└── tests/unit/, tests/e2e/
```

- **Im Root liegt keine zweite HTML-Datei.** Jede Seite ist ein Ordner unter `pages/` mit genau einer `index.html` (kein `css/`, kein `js/`).
- **Links sind absolut:** `/pages/<name>/` (mit Schrägstrich). Die Site läuft im Domain-Root (`base: '/'`).
- Die URL-Namen sind deutsch (`kontakt`, `autor`, `impressum`), die i18n-Namespaces englisch (`contact`, `author`, `imprint`).

---

## ⚡ REGEL #3 — Ein Modul, eine Verantwortung

- Jede JS-Datei hat genau **eine** Aufgabe und exportiert eine `init…()`-Funktion.
- **Maximal 200 Zeilen** pro Modul. Ausnahme: die Wörterbücher `de.js` / `en.js`.
- Neue Module in `main.js` importieren und dort starten — nirgends sonst.
- Module kommunizieren über Ereignisse (`rethink:langchange`, `rethink:pagechange`), nicht über globale Variablen.
- **Seitenwechsel:** `router.js` tauscht bei internen Links nur `<main>` und die Kopfdaten. Ein Modul, das Elemente aus `<main>` braucht, gehört in `initPage()` in `main.js` — es läuft dann nach jedem Wechsel erneut. Module, die nur Header/Footer betreffen (Navigation, Sprachschalter), laufen einmal und nutzen Event-Delegation auf `document`.

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

- **Englisch ist die Standardsprache.** Der Text im HTML ist der **englische Fallback** und muss dem EN-Wert exakt entsprechen (Test). Deutsch erscheint nur nach Klick auf DE (gemerkt in localStorage); `<html lang="en">`, `og:locale` en_US.
- Schlüssel-Format: `namespace.bereich.detail`, nur Kleinbuchstaben, Ziffern, `-` und `.`.
- Namespaces: `nav`, `footer`, `common`, `home`, `vision`, `design`, `space`, `deployment`, `dual`, `ip`, `news`, `author`, `contact`, `legal`, `imprint`, `privacy`, `notfound`.
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

Die 404-Seite trägt zusätzlich `<meta name="robots" content="noindex">`. Am einfachsten: Kopf von `pages/vision/index.html` kopieren und Namespace/Slug ersetzen.

---

## ⚡ REGEL #7 — Bilder

- Alle Bilder in `public/Bilder/`, Referenz als `src="/Bilder/…"`.
- Hero-Hintergründe als `<img class="hero-sub-bg">`, Split-Bilder als `<img>` in `.media` — keine `background-image` im Markup.
- Bilder unterhalb des sichtbaren Bereichs bekommen `loading="lazy"`.
- Das Portrait wird per `data-portrait-src` von `portrait.js` geladen, damit eine fehlende Datei den Build nicht bricht.
- Icons und OG-Bild liegen fertig in `public/` (`favicon.svg` ist die Quelle).

---

## ⚡ REGEL #8 — Kommentare (minimal)

Kommentare erklären das **Warum**, nicht das Was. Datei-Kopf mit einem Satz zur Verantwortung. Keine auskommentierten Code-Reste.

---

## ⚡ REGEL #9 — Vor jeder Änderung prüfen

1. Gibt es die Klasse / das Modul / den Schlüssel schon? (`grep` in `site.css`, `de.js`)
2. Passt die Änderung in ein bestehendes Modul, oder braucht sie ein neues?
3. Betrifft sie Header oder Footer? Dann **alle 13 Seiten** identisch ändern (Test vergleicht sie).

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

- [ ] `pages/<name>/index.html`, Kopf/Header/Footer 1:1 von `pages/vision/index.html` übernommen, Canonical/OG-URL auf `/pages/<name>/` gesetzt
- [ ] Schlüssel `<ns>.meta.title`, `<ns>.meta.description`, `<ns>.hero.*` in **de.js und en.js**
- [ ] Eintrag in `vite.pages.js`
- [ ] Eintrag in `public/sitemap.xml`
- [ ] Link in Header-Nav **und** Footer-Nav auf **allen** Seiten ergänzt
- [ ] Seite in `EXPECTED_PAGES` (`tests/unit/html-shell.test.js`) und `PAGES` (`tests/e2e/site.spec.js`) eintragen
- [ ] `npm run test:run && npm run build` grün

---

## ⚡ REGEL #12 — Secrets — NIEMALS im Repo (harter CI-Gate)

Die Pipeline (`.github/workflows/ci.yml`) scannt mit **gitleaks** die gesamte Historie. Findet der Scan ein Secret, gibt es weder Build noch Deploy. Formular-Endpunkte, API-Keys, SMTP-Daten gehören in GitHub Secrets oder auf den Server, nie in HTML oder JS.

---

## ⚡ REGEL #13 — Logo ist IMMER ein Home-Link

`<a class="logo" href="/pages/landing/">` im Header und Footer jeder Seite (Test).

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
<a class="card" href="/pages/space/">
  <h3 data-i18n="design.cards.material.title">Material</h3><hr class="rule" aria-hidden="true">
  <p data-i18n="design.cards.material.text">…</p>
  <span class="arrow-link" data-i18n="common.more">Learn more</span>
</a>

<!-- ✗ VERBOTEN — Kachel ohne Link -->
<div class="card">
  <h3>Material</h3>
  <p>…</p>
</div>
```

- Gilt für `.card`, `.card-media` (News), `.pillar` (Landing). Ziel ist immer `/pages/<name>/` (Test prüft, dass die Seite existiert).
- Ziel wählen: die Seite, die das Thema am tiefsten behandelt (Technik → `space`, Struktur/Material → `design`, Umsetzung → `deployment`, Haltung/Weg → `vision`). Gibt es später eigene Detailseiten, Ziel dorthin umhängen.
- Kein `onclick`, kein `<div>` — die Kachel selbst ist das `<a>` (Tastatur, Screenreader, Router funktionieren dann von allein).
- CSS: `.card:hover` hebt an und färbt den Rand, `.card:hover .arrow-link::after` schiebt den Pfeil, `:focus-visible` zeigt den Fokusring.
- Galerie-Bilder ohne eigene Seite: `<figure><a class="gallery-item" href="/Bilder/…" data-lightbox><img …></a><figcaption>…</figcaption></figure>` — `modules/lightbox.js` öffnet das Bild vergrößert in einem `<dialog>` (Escape, Schließen-Button, Klick daneben). Ohne JS führt der Link zur Bilddatei.
- Ohne Ziel keine Kachel-Optik: Listen (z. B. Bücher auf der Autorenseite) sind schlichte Listen mit Trennlinien.
- `tests/unit/html-shell.test.js`: „jede Kachel ist ein Link mit Ziel und Pfeil-Label“.

---

## ⚡ REGEL #16 — Bild- und Kachelgestaltung (Pflicht, ohne Nachfrage anwenden)

> **Jedes Bild füllt seine Fläche vollständig aus, alle Kacheln einer Reihe sind gleich groß, und die Wortmarke steht nur im Logo.**

### Warum
Schwarze Ränder (Letterboxing) und unterschiedlich hohe Kacheln wirken unfertig. Bilder mit eingebranntem „RETHINK“ doppeln das Logo und stören, seit der Hero die Wortmarke nicht mehr zeigt.

### Regeln

```css
/* ✓ Korrekt — feste Fläche, Bild füllt sie */
.pillar-media { aspect-ratio: 16 / 10; }
.pillar-media img { width: 100%; height: 100%; object-fit: cover; }

/* ✗ VERBOTEN — Bild wird eingepasst, Ränder bleiben schwarz */
.pillar-media img { object-fit: contain; background: #000; }
```

- Betroffen: `.pillar-media`, `.card-media`, `.gallery img`, `.split .media img`, `.hero-sub-bg`, `.portrait img`. Ausnahme ist nur die Lightbox selbst (dort zeigt `contain` das ganze Bild).
- Hochformatige Motive, deren Kopf wichtig ist (Zeitschriften-Titel), bekommen `object-position: top` (`.card-media--portrait`).
- **Bilder ohne Schriftzug:** `2026-09-Re-Think-*` und `2026-09-Re-Dual-Use.jpeg` tragen die eingebrannte Wortmarke und sind in `pages/` gesperrt (`html-shell.test.js`). Neue Varianten ohne Schriftzug als `…-clean.jpg` (zugeschnitten) oder `…-wide.jpg` (Querformat-Ausschnitt) ablegen; Zuschnitt per Canvas im Playwright-Chromium, kein zusätzliches Werkzeug nötig.
- **Galerie:** `href` und `src` zeigen auf dieselbe Datei, sonst öffnet die Lightbox ein anderes Bild (Test).
- **Unterseiten-Hero:** Inhaltsbreite wie die Überschrift (`min(100% - 48px, var(--maxw) - 48px)`), `aspect-ratio: 16/9`, `object-fit: cover`; `.hero-sub + section` hat verkürztes `padding-top`.
- **Landing-Hero:** Überschrift sind die zwei Leitsätze, beide weiß (`.hero h1 .accent { color: inherit }`), Button links darunter.
- **Schmale Geräte:** kein verschenkter Platz — Landing-Kacheln zweispaltig, Kurztext erst ab Tablet, News-Karten Bild links, Burger-Menü eng; Kachelblock beginnt tief genug, dass der Mondbogen sichtbar bleibt.

---

## ⚡ REGEL #17 — Deployment

- `dist/` läuft im Domain-Root. Docker-Image (`Dockerfile` + `deploy/nginx.conf`) wie FORGE, oder GitHub Pages mit eigener Domain.
- Sicherheits-Header, die im `<meta>` nicht wirken (`X-Frame-Options`, `nosniff`, `frame-ancestors`), setzt `deploy/nginx.conf`.
- Domain-Wechsel = drei Stellen: Canonical/OG in `pages/*/index.html`, `public/sitemap.xml`, `public/robots.txt`.
