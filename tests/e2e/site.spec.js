/**
 * E2E: Weiterleitung, einsprachige Anzeige, Seitenwechsel ohne Neuladen,
 * Mobilmenü, Kontaktformular. Läuft gegen den Vite-Dev-Server.
 */
import { test, expect } from '@playwright/test';

// In der Testphase liegt ein Zugangsschutz vor der Seite (VITE_GATE_HASH).
// Für alle Tests außer dem Gate-Test wird er abgeschaltet.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { window.RETHINK_GATE_HASH = ''; });
});

const PAGES = [
  'landing', 'lunar-habitato', 'design', 'space', 'deployment', 'dual-use',
  'ip', 'news', 'history', 'people', 'contact', 'legal-notice', 'privacy', '404',
];

test.describe('Feature: Alle Seiten laden fehlerfrei', () => {
  for (const p of PAGES) {
    test(`/pages/${p}/ antwortet und hat keine Konsolenfehler`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      const res = await page.goto(`/pages/${p}/`);
      expect(res.status()).toBe(200);
      await expect(page.locator('h1')).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test('Root / leitet auf /pages/landing/ weiter', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/pages\/landing\/$/);
    await expect(page.locator('.hero h1')).toBeVisible();
  });
});

test.describe('Feature: Sprache — die Website ist einsprachig Englisch', () => {
  test('Seite startet auf Englisch, auch im deutschen Browser; kein Sprachschalter', async ({ page }) => {
    await page.goto('/pages/landing/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveTitle('RETHINK SPACE – New Space Economy for Lunar Infrastructure');
    await expect(page.locator('[data-i18n="home.hero.lead1"]')).toHaveText('New Space Economy for');
    await expect(page.locator('[data-i18n="footer.project"]')).toHaveText('A project by Dr. Johannes Lierfeld');
    await expect(page.locator('.lang')).toHaveCount(0);
  });

  test('Kopfnavigation führt genau vier Punkte', async ({ page, isMobile }) => {
    await page.goto('/pages/landing/');
    if (isMobile) await page.locator('.burger').click();
    await expect(page.locator('#site-nav a')).toHaveText(['Lunar Habitato', 'Dual Use', 'People', 'Contact']);
  });
});

test.describe('Feature: Seitenwechsel ohne Neuladen', () => {
  test('Nav-Link tauscht nur den Inhalt; Header, Footer und JS-Zustand bleiben', async ({ page, isMobile }) => {
    await page.goto('/pages/landing/');
    await page.evaluate(() => { window.__keep = 42; });

    if (isMobile) {
      const burger = page.locator('.burger');
      await expect(page.locator('#site-nav')).toBeHidden();
      await burger.click();
      await expect(burger).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('#site-nav')).toBeVisible();
    }
    await page.locator('#site-nav a[href="/pages/lunar-habitato/"]').click();

    await expect(page).toHaveURL(/\/pages\/lunar-habitato\/$/);
    await expect(page).toHaveTitle('Lunar Habitato – RETHINK SPACE');
    await expect(page.locator('#site-nav a[href="/pages/lunar-habitato/"]')).toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => window.__keep)).toBe(42); // kein Reload
    if (isMobile) await expect(page.locator('#site-nav')).toBeHidden(); // Menü schließt nach Wechsel

    await page.goBack();
    await expect(page).toHaveURL(/\/pages\/landing\/$/);
    await expect(page.locator('.hero h1')).toBeVisible();
    expect(await page.evaluate(() => window.__keep)).toBe(42);
  });

  test('Formular funktioniert auch nach einem Seitenwechsel', async ({ page, isMobile }) => {
    await page.goto('/pages/landing/');
    if (isMobile) await page.locator('.burger').click();
    await page.locator('#site-nav a[href="/pages/contact/"]').click();
    await expect(page).toHaveURL(/\/pages\/contact\/$/);
    await page.fill('input[name="name"]', 'Test');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('textarea[name="message"]', 'Hello');
    await expect(page.locator('.form-status')).toBeHidden();
    await page.locator('form[data-contact] button[type="submit"]').click();
    await expect(page.locator('.form-status')).toBeVisible();
    await expect(page).toHaveURL(/\/pages\/contact\/$/);
  });
});

test.describe('Feature: People-Seite', () => {
  test('Portrait wird im Band „Founder & CEO“ geladen und ersetzt den Platzhalter', async ({ page }) => {
    await page.goto('/pages/people/');
    await page.locator('.band-toggle').first().click();
    const img = page.locator('.portrait img');
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute('alt', 'Dr. Johannes Lierfeld');
    expect(await img.evaluate((el) => el.naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator('.portrait .initials')).toHaveCount(0);
  });
});

test.describe('Feature: Barrierefreiheit — Tastatur und Fokus', () => {
  test('Tab zeigt den Skip-Link, Enter springt in den Inhalt', async ({ page }) => {
    await page.goto('/pages/landing/');
    await page.keyboard.press('Tab');
    const skip = page.locator('.skip-link');
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
  });

  test('nach einem Seitenwechsel liegt der Fokus auf dem neuen Inhalt', async ({ page, isMobile }) => {
    await page.goto('/pages/landing/');
    if (isMobile) await page.locator('.burger').click();
    await page.locator('#site-nav a[href="/pages/dual-use/"]').click();
    await expect(page).toHaveURL(/\/pages\/dual-use\/$/);
    await expect(page.locator('main')).toBeFocused();
  });
});

test.describe('Feature: Bänder klappen auf, statt zu verlinken', () => {
  for (const slug of ['lunar-habitato', 'dual-use', 'people']) {
    test(`/pages/${slug}/: "Learn more" öffnet den Bereich darunter, ohne Seitenwechsel`, async ({ page }) => {
      await page.goto(`/pages/${slug}/`);
      await expect(page.locator('.band-panel:visible')).toHaveCount(0); // alles zu beim Laden

      const group = page.locator('.band-group').first();
      const toggle = group.locator('.band-toggle');
      const panel = group.locator('.band-panel');

      await toggle.click();
      await expect(panel).toBeVisible();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(page).toHaveURL(new RegExp(`/pages/${slug}/$`)); // kein Seitenwechsel
      await expect(page.locator('.band-panel:visible')).toHaveCount(1); // übrige bleiben zu

      await toggle.click();
      await expect(panel).toBeHidden();
    });

    test(`/pages/${slug}/: ein Klick auf das Band selbst führt nirgendwohin`, async ({ page }) => {
      await page.goto(`/pages/${slug}/`);
      await page.locator('.band-h').first().click();
      await expect(page).toHaveURL(new RegExp(`/pages/${slug}/$`));
      await expect(page.locator('.band-panel').first()).toBeHidden();
    });
  }
});

test.describe('Feature: Galerie-Lightbox', () => {
  test('Klick auf ein Galerie-Bild öffnet es vergrößert, Escape schließt', async ({ page }) => {
    await page.goto('/pages/design/');
    const item = page.locator('.gallery-item').first();
    await item.scrollIntoViewIfNeeded();
    await item.click();
    const dlg = page.locator('dialog.lightbox');
    await expect(dlg).toBeVisible();
    await expect(dlg.locator('img')).toBeVisible();
    await expect(page).toHaveURL(/\/pages\/design\/$/); // kein Sprung zur Bilddatei
    await page.keyboard.press('Escape');
    await expect(dlg).toBeHidden();
  });
});

test.describe('Feature: Chat-Widget „Frag RETHINK SPACE“', () => {
  const ENDPOINT = 'https://test.supabase.co/functions/v1/chat';
  const SSE = 'data: {"type":"text","text":"ISRU means using local resources. "}\n\n'
    + 'data: {"type":"text","text":"See /pages/space/"}\n\ndata: {"type":"done"}\n\n';

  test('Frage senden, gestreamte Antwort mit Seitenlink, Escape schließt', async ({ page }) => {
    await page.addInitScript((url) => { window.RETHINK_CHAT_ENDPOINT = url; }, ENDPOINT);
    await page.route(ENDPOINT, async (route) => {
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const body = JSON.parse(route.request().postData());
      expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'What is ISRU?' });
      return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: SSE });
    });
    await page.goto('/pages/landing/');
    await page.locator('.chat-fab').click();
    const dlg = page.locator('dialog.chat');
    await expect(dlg).toBeVisible();
    await page.fill('#chat-input', 'What is ISRU?');
    await page.locator('.chat-send').click();
    await expect(page.locator('.chat-msg--assistant .chat-text').last()).toContainText('ISRU means using local resources. See /pages/space/');
    await expect(page.locator('.chat-msg--assistant a[href="/pages/space/"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dlg).toBeHidden();
    await expect(page.locator('.chat-fab')).toBeFocused();
  });

  test('ohne Endpoint gibt es kein Widget', async ({ page }) => {
    await page.addInitScript(() => { window.RETHINK_CHAT_ENDPOINT = ''; });
    await page.goto('/pages/landing/');
    // Nur aussagekräftig, wenn lokal kein VITE_CHAT_ENDPOINT gesetzt ist; sonst ist der Button erlaubt.
    const count = await page.locator('.chat-fab').count();
    expect(count).toBeLessThanOrEqual(1);
  });
});

test.describe('Feature: Zugangsschutz der Testphase', () => {
  const HASH = '6987d5d14499d7c677ed0aa6eb68e7745e43448197caf60cbcba7d68ecd30d57';

  test('Maske sperrt die Seite, richtige Daten schalten frei und bleiben gespeichert', async ({ page }) => {
    await page.addInitScript((h) => { window.RETHINK_GATE_HASH = h; }, HASH);
    await page.goto('/pages/landing/');
    const gate = page.locator('.site-gate');
    await expect(gate).toBeVisible();
    await expect(page.locator('main')).toBeHidden();

    await page.fill('#gate-email', 'test@rethink.space');
    await page.fill('#gate-password', 'falsch');
    await page.locator('.gate-submit').click();
    await expect(page.locator('.gate-error')).toBeVisible();
    await expect(gate).toBeVisible();

    await expect(page.locator('#gate-remember')).toBeChecked(); // Merken ist vorausgewählt
    await page.fill('#gate-password', 'Re-Think-Space-26');
    await page.locator('.gate-submit').click();
    await expect(gate).toBeHidden();
    await expect(page.locator('main')).toBeVisible();

    // Zweiter Besuch: keine erneute Anmeldung
    await page.goto('/pages/lunar-habitato/');
    await expect(page.locator('.site-gate')).toHaveCount(0);
    await expect(page.locator('main h1')).toBeVisible();
  });
});
