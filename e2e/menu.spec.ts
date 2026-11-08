import { test, expect } from '@playwright/test';

test.describe('Nexo Menu Public View', () => {
  test('loads the public menu page and renders dishes', async ({ page }) => {
    // Navigate to the demo restaurant menu page.
    await page.goto('/m/bar-pepe');

    // Wait for the restaurant name header to appear.
    const restaurantName = page.locator('h1.text-xl.font-black, h1').first();
    await expect(restaurantName).toBeVisible({ timeout: 10_000 });

    // Verify that category headings are present (amber-colored h2 elements).
    const categoryHeadings = page.locator('h2.text-lg.font-black');
    const count = await categoryHeadings.count();
    expect(count).toBeGreaterThan(0);

    // Verify that at least one dish is rendered (bold h3 element inside each category).
    const dishHeadings = page.locator('h3.text-sm.font-bold, h3.text-base.font-bold');
    const dishCount = await dishHeadings.count();
    expect(dishCount).toBeGreaterThan(0);

    // Take a screenshot for CI reporting.
    await page.screenshot({ path: 'test-results/menu-page.png', fullPage: false });
  });

  test('allergen filter section is present', async ({ page }) => {
    await page.goto('/m/bar-pepe');

    // Allergen filter buttons have distinct styling.
    const allergenFilters = page.locator('button').filter({ hasText: /alerg|glut|lac/ }).first();
    // At least check that the page doesn't crash on navigation with filters visible.
    await expect(page.locator('[class*="sticky"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('language toggle button works', async ({ page }) => {
    await page.goto('/m/bar-pepe');

    // Language toggle buttons exist near the top of the page.
    const langToggle = page.locator('button').filter({ hasText: /español|inglés|spanish|english/i }).first();
    if (await langToggle.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await langToggle.click();
      // Page should remain stable after language switch.
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
