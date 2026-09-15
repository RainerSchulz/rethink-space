/**
 * E2E: Weiterleitung, Sprachwechsel, Seitenwechsel ohne Neuladen,
 * Mobilmenü, Kontaktformular. Läuft gegen den Vite-Dev-Server.
 */
import { test, expect } from '@playwright/test';

const PAGES = [
  'landing', 'vision', 'design', 'space', 'deployment', 'dual-use',
  'ip', 'news', 'autor', 'kontakt', 'impressum', 'datenschutz', '404',
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

test.describe('Feature: Sprache — Englisch ist Standard, Deutsch optional', () => {
  test('Seite startet auf Englisch, auch im deutschen Browser', async ({ page }) => {
    await page.goto('/pages/landing/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveTitle('RE-THINK SPACE – New ways. New spaces.');
    await expect(page.locator('[data-i18n="home.hero.lead1"]')).toHaveText('New ways. New spaces.');
    await expect(page.locator('.lang button[data-lang="en"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('DE übersetzt Seite und Titel, bleibt nach Reload und Seitenwechsel erhalten', async ({ page, isMobile }) => {
    await page.goto('/pages/landing/');
    if (isMobile) await page.locator('.burger').click();
    await page.locator('.lang button[data-lang="de"]').click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page).toHaveTitle('RE-THINK SPACE – Neue Wege. Neue Räume.');
    await expect(page.locator('[data-i18n="home.hero.lead1"]')).toHaveText('Neue Wege. Neue Räume.');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.locator('[data-i18n="nav.author"]').first()).toHaveText('Autor');

    if (isMobile) await page.locator('.burger').click();
    await page.locator('#site-nav a[href="/pages/vision/"]').click();
    await expect(page.locator('main h1')).toHaveText('Raum für morgen.');
    await expect(page).toHaveTitle('Vision – RE-THINK SPACE');
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
    await page.locator('#site-nav a[href="/pages/vision/"]').click();

    await expect(page).toHaveURL(/\/pages\/vision\/$/);
    await expect(page.locator('main h1')).toHaveText('Space for tomorrow.');
    await expect(page).toHaveTitle('Vision – RE-THINK SPACE');
    await expect(page.locator('#site-nav a[href="/pages/vision/"]')).toHaveAttribute('aria-current', 'page');
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
    await page.locator('#site-nav a[href="/pages/kontakt/"]').click();
    await expect(page).toHaveURL(/\/pages\/kontakt\/$/);
    await page.fill('input[name="name"]', 'Test');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('textarea[name="message"]', 'Hello');
    await expect(page.locator('.form-status')).toBeHidden();
    await page.locator('form[data-contact] button[type="submit"]').click();
    await expect(page.locator('.form-status')).toBeVisible();
    await expect(page).toHaveURL(/\/pages\/kontakt\/$/);
  });
});

test.describe('Feature: Autorenseite', () => {
  test('fehlendes Portrait zeigt Platzhalter mit Initialen', async ({ page }) => {
    await page.goto('/pages/autor/');
    await expect(page.locator('.portrait .initials')).toHaveText('JL');
  });
});
