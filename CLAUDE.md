# RE-THINK SPACE — Claude Code Context

## Projekt-Übersicht
**RE-THINK SPACE** — statische Website, zweisprachig DE/EN, 13 Seiten unter `pages/`
- **Inhaber:** Dr. Johannes Lierfeld · **Umsetzung:** Rainer Schulz · Schulz-Solutions
- **Repo:** github.com/RainerSchulz/rethink-space · **Domain (angenommen, prüfen):** re-think-space.de
- **Dev-Server:** `npm install` → `npm run dev` → http://localhost:3100/pages/landing/
- **Stack:** Vite 8 · Vanilla JS (ES-Module) · Vitest · Playwright · ESLint · gitleaks · Docker/nginx

Aufgebaut nach dem FORGE-Portal-Muster (forge-portal-vite): Root-`index.html` leitet auf `/pages/landing/` weiter, jede Seite liegt als `pages/<name>/index.html` (nur Markup + Kopfdaten), ein Entry `src/site/main.js`, Module mit je einer Verantwortung, DE/EN-Wörterbuch mit `t()`, Seitenliste in `vite.pages.js`.

---

## KRITISCHE REGELN (immer befolgen)

### 1. Übersetzungen — NIEMALS hartkodierter Text, Englisch ist Standard
```html
<!-- ✓ Korrekt -->
<h2 data-i18n="vision.road.title">From study to structure.</h2>
<!-- ✗ VERBOTEN -->
<h2>From study to structure.</h2>
```
- Schlüssel IMMER simultan in `src/site/i18n/de.js` **und** `en.js`.
- Englischer Text im HTML = EN-Wert (Test vergleicht). Startsprache ist immer Englisch, Deutsch nur nach Wahl (localStorage).
- `tests/unit/i18n.test.js` prüft Parität, Abdeckung und ungenutzte Schlüssel.

### 2. HTML-Shells enthalten nur Markup und Kopfdaten
Kein `<style>`, kein `style="…"`, kein `<script>` außer dem Vite-Entry und JSON-LD, kein `onclick`. Das Stylesheet wird per `<link rel="stylesheet" href="/src/site/site.css">` im Head geladen (nicht per JS-Import, sonst Aufblitzen ohne CSS). Jede Seite hat Canonical, Open Graph, CSP-Meta, Favicon, Manifest. `tests/unit/html-shell.test.js` erzwingt das.

### 2a. Seitenwechsel läuft über den Router
`src/site/modules/router.js` tauscht bei internen Links nur `<main>` und die Kopfdaten (kein Reload, Überblendung). Module, die den Seiteninhalt brauchen (Formular, Portrait), werden in `main.js` in `initPage()` gestartet und nach jedem `rethink:pagechange` erneut ausgeführt.

### 3. Nur `index.html` im Root; jede Seite ist `pages/<name>/index.html`
Links sind absolut: `/pages/<name>/`. Neue Seite → `vite.pages.js`, `public/sitemap.xml`, Header- und Footer-Nav auf **allen** Seiten, `EXPECTED_PAGES` in den Tests.

### 4. Header und Footer sind auf allen Seiten identisch
Änderung am Rahmen → alle Seiten. Aktive Seite setzt `nav.js` per `aria-current`, nicht das HTML.

### 5. Jedes neue Modul in `src/site/main.js` starten
```javascript
import { initNeu } from './modules/neu.js';
initNeu();
```

### 6. Secrets — NIEMALS im Repo
CI scannt mit gitleaks. Kein Build, kein Deploy bei Fund.

### 7. Nach jeder Änderung testen
```bash
npm run lint && npm run test:run && npm run build
npm run test:e2e   # bei HTML/Nav/Sprache/Formular
```

Vollständiger Guide: `.claude/skills/coding-guide.md`

---

## Struktur
| Pfad | Inhalt |
|---|---|
| `index.html` | Weiterleitung auf `/pages/landing/` |
| `pages/<name>/index.html` | 13 Seiten-Shells (inkl. `404`) |
| `vite.pages.js` | Seitenliste für den Build (`RETHINK_PAGES` wählt Teilmengen) |
| `public/` | `Bilder/`, `favicon.svg`, Icons, `og-image.jpg`, `robots.txt`, `sitemap.xml`, `site.webmanifest` |
| `src/site/main.js` | Vite-Entry |
| `src/site/site.css` | Alle Stile |
| `src/site/fonts.css` | Inter, selbst gehostet (fontsource) |
| `src/site/i18n/` | `index.js` (Runtime), `de.js`, `en.js` |
| `src/site/modules/` | `router.js`, `nav.js`, `lang-switch.js`, `contact.js`, `portrait.js` |
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
- Portrait als `public/Bilder/Lierfeld.jpg` ablegen (Hochformat 3:4)
- Impressum und Datenschutz ausfüllen (Platzhalter)
- Kontaktformular an einen Versanddienst anbinden (`src/site/modules/contact.js`)
- E-Mail-Adresse `kontakt@re-think-space.de` prüfen (Footer, Kontaktseite, JSON-LD)
- Buchangaben auf der Autorenseite ergänzen, Bildzuordnung prüfen
- GitHub Pages: Source = "GitHub Actions" + Custom domain, oder Docker-Image auf dem eigenen Server
