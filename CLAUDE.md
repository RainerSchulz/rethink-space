# RETHINK SPACE — Claude Code Context

## Projekt-Übersicht
**RETHINK SPACE** — statische Website, einsprachig Englisch (DE-Wörterbuch bleibt gepflegt), 14 Seiten unter `pages/`
- **Träger:** RETHINK SPACE Inc. (C-Corporation in Formation), Delaware/USA · **Inhaber:** Dr. Johannes Lierfeld · **Umsetzung:** Rainer Schulz · Schulz-Solutions
- **Repo:** github.com/RainerSchulz/rethink-space · **Domain:** rethink.space (Stand 16.09.2026)
- **Dev-Server:** `npm install` → `npm run dev` → http://localhost:3100/pages/landing/
- **Stack:** Vite 8 · Vanilla JS (ES-Module) · Vitest · Playwright · ESLint · gitleaks · Docker/nginx

Aufgebaut nach dem FORGE-Portal-Muster (forge-portal-vite): Root-`index.html` leitet auf `/pages/landing/` weiter, jede Seite liegt als `pages/<name>/index.html` (nur Markup + Kopfdaten), ein Entry `src/site/main.js`, Module mit je einer Verantwortung, DE/EN-Wörterbuch mit `t()`, Seitenliste in `vite.pages.js`.

---

## KRITISCHE REGELN (immer befolgen)

### 1. Übersetzungen — NIEMALS hartkodierter Text, die Seite ist einsprachig Englisch
```html
<!-- ✓ Korrekt -->
<h2 data-i18n="habitat.road.title">From study to structure.</h2>
<!-- ✗ VERBOTEN -->
<h2>From study to structure.</h2>
```
- Schlüssel IMMER simultan in `src/site/i18n/de.js` **und** `en.js` (Paritätstest), auch wenn DE gerade nicht angezeigt wird.
- Englischer Text im HTML = EN-Wert (Test vergleicht). Die Seite zeigt **nur Englisch**: kein DE/EN-Schalter, `detectInitialLang()` liefert fest `'en'`, eine früher gespeicherte Wahl wird ignoriert. Das deutsche Wörterbuch bleibt gepflegt, damit die zweite Sprache später ohne Umbau zurückkommt (Schalter + `detectInitialLang()`).
- `tests/unit/i18n.test.js` prüft Parität, Abdeckung und ungenutzte Schlüssel.

### 2. HTML-Shells enthalten nur Markup und Kopfdaten
Kein `<style>`, kein `style="…"`, kein `<script>` außer dem Vite-Entry und JSON-LD, kein `onclick`. Das Stylesheet wird per `<link rel="stylesheet" href="/src/site/site.css">` im Head geladen (nicht per JS-Import, sonst Aufblitzen ohne CSS). Jede Seite hat Canonical, Open Graph, CSP-Meta, Favicon, Manifest. `tests/unit/html-shell.test.js` erzwingt das.

### 2a. Seitenwechsel läuft über den Router
`src/site/modules/router.js` tauscht bei internen Links nur `<main>` und die Kopfdaten (kein Reload, Überblendung). Module, die den Seiteninhalt brauchen (Formular, Portrait), werden in `main.js` in `initPage()` gestartet und nach jedem `rethink:pagechange` erneut ausgeführt.

### 3. Nur `index.html` im Root; jede Seite ist `pages/<name>/index.html`
Links sind absolut: `/pages/<name>/`. Neue Seite → `vite.pages.js`, `public/sitemap.xml`, Header- und Footer-Nav auf **allen** Seiten, `EXPECTED_PAGES` in den Tests.

### 4. Header und Footer sind auf allen Seiten identisch
Die Kopfnavigation führt genau vier Punkte, alle gleich gestaltet (kein abgesetzter Kontakt-Button, kein Sprachschalter):
`Lunar Habitato` (`/pages/lunar-habitato/`) · `Dual Use` (`/pages/dual-use/`) · `People` (`/pages/people/`) · `Contact` (`/pages/contact/`).
Der Footer ist eine Zeile: Copyright, Impressum, Datenschutz, Projekthinweis und rechts die Symbole für LinkedIn und E-Mail. Keine Footer-Navigation.
Änderung am Rahmen → alle Seiten. Aktive Seite setzt `nav.js` per `aria-current`, nicht das HTML.

### 5. Jedes neue Modul in `src/site/main.js` starten
```javascript
import { initNeu } from './modules/neu.js';
initNeu();
```

### 6. Secrets — NIEMALS im Repo
CI scannt mit gitleaks. Kein Build, kein Deploy bei Fund.

### 7. Barrierefreiheit gehört zum Rahmen
Jede Seite hat den Skip-Link im Header, `<main id="main" tabindex="-1">` (Fokusziel nach Seitenwechsel), benannte `<nav aria-label>` (über i18n), dekorative `<hr class="rule" aria-hidden="true">`. Fokusring `:focus-visible`, Touch-Ziele ≥ 24 px, Buttons mit AA-Kontrast (`--accent-btn`), `prefers-reduced-motion`, `prefers-contrast`, `forced-colors` in `site.css` Abschnitt 2a. Tests: `html-shell.test.js` und E2E „Barrierefreiheit“.

### 8. Kacheln sind IMMER klickbar (wie FORGE)
Jede Kachel (`.card`, `.card-media`, `.pillar`) ist ein `<a class="card" href="/pages/<ziel>/">` mit `<span class="arrow-link" data-i18n="common.more">` und führt auf die Seite, die das Thema vertieft. Galerie-Bilder sind `<a class="gallery-item" href="/Bilder/…" data-lightbox>`: `lightbox.js` öffnet sie vergrößert im `<dialog>`. Kein `<div class="card">`. Was keinen Link hat, bekommt keine Kachel-Optik (z. B. Bücherliste). `tests/unit/html-shell.test.js` erzwingt das.
**Ausnahme — die Bänder der drei Menüseiten:** auf `/pages/lunar-habitato/` (4 Bänder), `/pages/dual-use/` (Defense Options, Down Streaming) und `/pages/people/` (Founder & CEO, Team) ist die Fläche ausdrücklich *kein* Link. Nur der Knopf `.band-toggle` („Learn more") klappt den Bereich `.band-panel` direkt darunter auf, ohne Seitenwechsel (`modules/bands.js`, `aria-expanded` + `aria-controls`). Alle Bereiche tragen `hidden` schon im Markup, damit beim Laden nichts aufgeklappt aufblitzt. Deshalb heißen die Klassen `.band*` und nicht `.card`/`.pillar` — die Kachelregel oben bleibt für echte Kacheln scharf. Neue Bandseite → `BAND_PAGES` in `tests/unit/html-shell.test.js` und die Schleife im E2E-Block ergänzen.

### 9. Chatbot: Schlüssel nur im Backend, Wissen nur generiert
Der Anthropic-Schlüssel liegt ausschließlich als Supabase-Secret in der Edge Function. Die Website kennt nur die öffentliche Endpoint-URL (`VITE_CHAT_ENDPOINT` in `.env`, gitignored; in CI als Repository-Variable). Ohne Endpoint bleibt das Widget aus. Die Wissensbasis liegt in der Tabelle `public.chat_knowledge` (Supabase-Projekt Re-Think-Space, ref `bdkvdufrdkxezutktzlt`); nach Textänderungen `npm run knowledge` (baut `knowledge.txt`, gitignored) und `npm run knowledge:push` (Admin-Login, kein Redeploy nötig). Buchmanuskripte (NAS: `W:/Projekte/Re-Think/Doku`) nie ins Repo, nur die Zusammenfassungen unter `knowledge/books/`.

### 10. Bilder und Kacheln — feste Gestaltungsregeln (gilt ohne Nachfrage)
- **Bilder füllen ihre Fläche immer aus** (`object-fit: cover`). Keine schwarzen Ränder, kein Letterboxing — gilt für `.pillar-media`, `.card-media`, `.gallery`, `.split .media`, `.hero-sub-bg`, `.portrait`.
- **Kacheln einer Reihe sind immer gleich groß**, im Zweifel kleiner statt größer (festes `aspect-ratio`, Bild per cover einpassen).
- **Farbe:** der Akzent ist `#00d9ff` (`--accent`), auf Schwarz 12,4:1. Auf farbigen Flächen ist die Schrift **schwarz** (`--accent-on`) — weiß käme nur auf 1,7:1 und fiele durch. Kein Orange mehr: Favicon, `og-image.jpg` und alle Token sind umgestellt.
- **Wortmarke:** `SPACE` ist per `letter-spacing: .2784em` auf die Breite von `RETHINK` gesperrt, gleiche Schrift und Größe; der negative Rand nimmt die Sperrung hinter dem letzten Buchstaben zurück. Beim Neubau von `og-image.jpg` wird die Sperrung gemessen, nicht geraten.
- **Die Wortmarke steht nur im Header- und Footer-Logo.** Bilder mit eingebranntem „RETHINK“/„WE RETHINK X“ nicht verwenden: Schriftzug wegschneiden (Datei `…-clean.jpg`) oder textfreies Motiv nehmen. Dateien `2026-09-Re-Think-*` und `2026-09-Re-Dual-Use.jpeg` sind die Originale mit Schriftzug und in `pages/` gesperrt (Test).
- **Beim Bildtausch in Galerien immer `href` und `src` gemeinsam ändern**, sonst zeigt die Lightbox das alte Bild (Test).
- **Startseite:** nur Claim (`home.hero.lead1`/`lead2`, in Versalien, beide weiß) und Mond — kein Button, keine Kacheln, keine News-Sektion. Der Mondbereich füllt den Bildschirm (`min-height` auf `.moonscape`); die Mondscheibe beginnt dicht unter der Überschrift (`--moon-top`) und füllt den unteren Bereich (`--moon-d`).
- **Bandseiten (`lunar-habitato`, `dual-use`, `autor`):** gleich große Bänder untereinander (`.bands` > `.band-group`), Bild per cover über die ganze Fläche, Überschrift in Schrift und Größe der Startseiten-Überschrift (`.band-h` = `.hero h1`). Die Überschrift steht **links unten** im Bild, „Learn more" dicht darunter (2 px). Das erste Band trägt das `<h1>` der Seite, die übrigen `<h2>`. Jedes Band bekommt ein eigenes Motiv — keine zwei Bänder mit demselben Bild. Aufgeklappt wird über „Learn more", nicht verlinkt (siehe Regel 8).
- **Motive, die im breiten Band nicht aufgehen:** hochformatige Fotos bekommen `.band-media--top` (Ausschnitt nach oben, sonst ist der Kopf ab). Sehr breite Motive wie das Partner-Logoband brauchen fürs Handy eine eigene Fassung im 3:2-Format (`…-hoch.jpg`, eingebunden per `<picture><source media="(max-width: 820px)">`) — sonst schneidet der schmale Rahmen die Hälfte weg.
- **Unterseiten-Hero:** Bild in Inhaltsbreite wie die Überschrift, einheitliches 16:9-Fenster, Inhalt schließt dicht an (`.hero-sub + section`).
- **Handy und Tablet:** kompakt, kein verschenkter Platz — News-Karten Bild links/Text rechts, enges Burger-Menü.
- Textdokumente (Poster, Zertifikat) nur dort einsetzen, wo die Lightbox sie lesbar macht.

### 11. Testphase: Zugangsschutz über `VITE_GATE_HASH`
`gate.js` legt eine Anmeldemaske vor die Seite, sobald `VITE_GATE_HASH` gesetzt ist: ein SHA-256 von `e-mail:passwort` (kleingeschrieben) oder mehrere, durch Komma getrennt. Die Checkbox „Angemeldet bleiben“ (vorausgewählt) entscheidet zwischen localStorage und sessionStorage; der Browser darf die Daten speichern (`autocomplete`). Zum Livegang genügt es, die Variable zu entfernen — kein Codeumbau. **Kein echter Schutz:** die Dateien liegen weiter statisch auf dem Server; für echte Sperre braucht es Basic Auth auf einem eigenen Server oder Cloudflare Access.

### 12. Nach jeder Änderung testen
```bash
npm run lint && npm run test:run && npm run build
npm run test:e2e   # bei HTML/Nav/Sprache/Formular
```
Nach Textänderungen zusätzlich: `npm run knowledge && npm run knowledge:push` (Chatbot) und im CMS `npm run import`.
Committen und pushen nur auf ausdrückliche Aufforderung.

### 13. Inhalte aus dem CMS kommen nur über `content:apply` zurück
Redaktionelle Änderungen macht der Inhaber im CMS (`../rethink-cms`, eigenes Repo), nicht von Hand in `en.js`:
```bash
# im CMS: Veröffentlichen → Export herunterladen (site-content.json)
npm run content:apply -- "C:/Users/<du>/Downloads/site-content.json"
npm run lint && npm run test:run && npm run build     # danach immer
```
Das Skript fasst **nur** an, was im Export steht; unbekannte Schlüssel meldet es und legt sie nicht an — **neue Schlüssel gehören weiter in den Code**, danach im CMS `npm run import`. Zweimal laufen lassen ändert nichts mehr.
Der Editor zeigt nur Englisch; fehlt ein deutscher Text, schreibt der Generator den englischen nach `de.js`, damit der Paritätstest hält.

Vollständiger Guide: `.claude/skills/coding-guide.md`

---

## Struktur
| Pfad | Inhalt |
|---|---|
| `index.html` | Weiterleitung auf `/pages/landing/` |
| `pages/<name>/index.html` | 14 Seiten-Shells (inkl. `404`). **Alle Adressen sind englisch** — `lunar-habitato` (früher `vision`), `people` (`autor`), `contact` (`kontakt`), `legal-notice` (`impressum`), `privacy` (`datenschutz`) |
| `vite.pages.js` | Seitenliste für den Build (`RETHINK_PAGES` wählt Teilmengen) |
| `public/` | `Bilder/`, `favicon.svg`, Icons, `og-image.jpg`, `robots.txt`, `sitemap.xml`, `site.webmanifest` |
| `public/Bilder/moon-full.jpg` | Vollmond der Landingpage (Mondscheibe in `.moonscape`). Quelle: NASA SVS „Full Moon“ (LRO/LOLA-Daten, nasa_id GSFC_20171208_Archive_e001861), gemeinfrei, auf die Scheibe zugeschnitten |
| `src/site/main.js` | Vite-Entry |
| `src/site/site.css` | Alle Stile |
| `src/site/fonts.css` | Inter, selbst gehostet (fontsource) |
| `src/site/i18n/` | `index.js` (Runtime), `de.js`, `en.js` |
| `src/site/modules/` | `router.js`, `nav.js`, `contact.js`, `portrait.js`, `lightbox.js`, `bands.js`, `chat.js`, `gate.js` |
| `supabase/` | Chatbot-Backend: Edge Function `functions/chat/` (Claude-Aufruf, Streaming), `knowledge/` (Fakten, Autor, Buchzusammenfassungen), Migration `chat_log`; Anleitung in `supabase/README.md` |
| `scripts/apply-content.mjs`, `lib/apply.mjs` | `npm run content:apply -- <export.json>` schreibt einen CMS-Export zurück: Werte nach `en.js`/`de.js`, englischer Text an jedes `data-i18n`-Element, Bildpfade in den Shells. Umformungen in `lib/apply.mjs`, geprüft von `tests/unit/apply-content.test.js` |
| `scripts/build-knowledge.mjs`, `push-knowledge.mjs` | `npm run knowledge` baut `knowledge.txt` aus Wörterbüchern + `knowledge/`; `npm run knowledge:push` lädt sie nach `public.chat_knowledge` |
| `deploy/nginx.conf`, `Dockerfile` | Auslieferung wie FORGE (nginx:alpine) |
| `tests/unit/`, `tests/e2e/` | Vitest, Playwright |
| `.github/workflows/ci.yml` | Lint · Test · gitleaks · Build · Deploy (GitHub Pages) |

---

## Umgebung
- **Arbeitskopie:** `C:/Projekte/Re-Think/rethink-space` (lokal, seit 15.09.2026). Auf dem NAS (`W:/Projekte/Re-Think/rethink-space-website/rethink-space`) liegt nur ein normaler Git-Clone als Ablage — dort nicht entwickeln: der SMB-Share lädt `node_modules` so langsam, dass Vitest-Worker in den Start-Timeout laufen (gemessen: ein einzelner Bibliotheks-Import 69 s). Sync läuft über GitHub (`origin`).
- `npm install` braucht `legacy-peer-deps` (steht in `.npmrc`).
- Vitest läuft sequenziell im `vmThreads`-Pool mit happy-dom (`vitest.config.js`).
- Nach `npm run test:e2e` prüfen, dass kein `vite`-Prozess hängen bleibt (Port 3100).

## Offen vor Livegang (Stand 15.09.2026)
- Domain in Canonical/OG (`pages/*/index.html`), `public/sitemap.xml`, `public/robots.txt` prüfen
- Impressum und Datenschutz sind auf **US-Recht** umgeschrieben (Delaware als anwendbares Recht, US-Urheberrecht und DMCA, Haftungsausschluss statt deutscher Paragrafen). Die Datenschutzerklärung führt beide Seiten: DSGVO für Besucher aus Europa, dazu die Rechte nach US-Bundesstaatenrecht. Offen: Telefonnummer, Registered Agent, State File Number, Steuernummer; ob eine EU-Vertretung nach Art. 27 DSGVO nötig ist; und die **anwaltliche Prüfung auf beiden Seiten** — beides sind Entwürfe.
- Kontaktformular an einen Versanddienst anbinden (`src/site/modules/contact.js`)
- E-Mail-Postfach `contact@rethink.space` einrichten (Footer, Kontaktseite, JSON-LD verweisen darauf)
- Bücher (Autorenseite): fünf Titel mit Verlag, Jahr und Amazon-Link (ISBN) gesetzt; Coverbilder optional, Bildzuordnung prüfen
- Bildnachweis NASA (Vollmond, `moon-full.jpg`) im Impressum nennen
- GitHub Pages: Source = "GitHub Actions" + Custom domain, oder Docker-Image auf dem eigenen Server
- Vor dem Livegang: Repository-Variable `VITE_GATE_HASH` entfernen, damit die Anmeldemaske verschwindet
- Seiten ohne Weg hinein: seit dem Umbau auf Bänder (23.09.2026) verlinkt nichts mehr auf `design`, `space`, `deployment`, `ip`, `news` und `history`. Ihre Inhalte stehen teils schon in den aufklappbaren Bereichen. Entscheiden, ob diese Seiten verlinkt, eingearbeitet oder gelöscht werden.
- CMS: der Rückweg Export → Website steht (`npm run content:apply`). Offen: Publish-Knopf im CMS an GitHub Actions hängen (`repository_dispatch`), damit ohne Terminal veröffentlicht werden kann; CMS für Dr. Lierfeld deployen; Supabase-Adapter gegen das echte Projekt testen; Admin-Passwort zurücksetzen (`admin1234` greift nicht mehr)
- Chatbot: Funktion `chat` ist im Projekt Re-Think-Space deployt, Wissensbasis und CMS-Tabellen befüllt (16.09.2026). Offen: Secret `ANTHROPIC_API_KEY` im Dashboard setzen, `VITE_CHAT_ENDPOINT` als GitHub-Variable, Datenschutzerklärung um den KI-Dienst (Anthropic) ergänzen
