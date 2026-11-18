import { test, expect, type Page } from '@playwright/test';

/**
 * Helper to advance past the Two-Stage Boot Guard (`AppBootGuard` -> `SplashScreen`)
 * into the authentication/activation gate without external network dependencies.
 */
async function advancePastBootScreens(page: Page): Promise<void> {
  const skipIntroBtn = page.getByRole('button', { name: /Passer l'intro/i });
  if (await skipIntroBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await skipIntroBtn.click();
  }

  const skipSplashBtn = page.getByRole('button', { name: /Accéder directement/i });
  if (await skipSplashBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await skipSplashBtn.click();
  }
}

test.describe('CIOB GMAO Nexus v5.0.2 - Core E2E & SSOT Verification (E2E-P1)', () => {
  test('1) Loads application shell and verifies API health & Swagger docs endpoint', async ({
    page,
    request,
  }) => {
    const healthRes = await request.get('/api/health');
    expect(healthRes.ok()).toBeTruthy();
    const healthJson = await healthRes.json();
    expect(healthJson.status).toBe('healthy');

    const openapiRes = await request.get('/api/docs.json');
    expect(openapiRes.ok()).toBeTruthy();
    const openapiJson = await openapiRes.json();
    expect(openapiJson.openapi).toBe('3.0.0');
    expect(openapiJson.info.title).toContain('CIOB GMAO');

    await page.goto('/');
    await expect(page).toHaveTitle(/CIOB GMAO/i);
  });

  test('2) Completes two-stage boot sequence (AppBootGuard -> SplashScreen) and displays First-Run License Activation Gate', async ({
    page,
  }) => {
    await page.goto('/');

    // Stage 1: AppBootGuard intro screen
    const skipIntroBtn = page.getByRole('button', { name: /Passer l'intro/i });
    await expect(skipIntroBtn).toBeVisible();
    await skipIntroBtn.click();

    // Stage 2: SplashScreen manifest loader
    const skipSplashBtn = page.getByRole('button', { name: /Accéder directement/i });
    await expect(skipSplashBtn).toBeVisible();
    await skipSplashBtn.click();

    // Stage 3: First-Run Dual-Secret License & Admin Activation Gate (LOGIN-LICENSE-P0)
    await expect(page.locator('#input-setup-organization')).toBeVisible();
    await expect(page.locator('#input-setup-license-key')).toBeVisible();
    await expect(page.locator('#input-setup-license-confirm')).toBeVisible();
    await expect(page.locator('#input-setup-admin-password')).toBeVisible();
    await expect(page.locator('#input-setup-admin-password-confirm')).toBeVisible();
    await expect(page.locator('#btn-setup-pin')).toBeDisabled();
  });

  test('3) Enforces LOGIN-LICENSE-P0 secret separation on Activation Gate (blocks identical License Key and Admin Password)', async ({
    page,
  }) => {
    await page.goto('/');
    await advancePastBootScreens(page);

    const setupBtn = page.locator('#btn-setup-pin');
    await expect(setupBtn).toBeDisabled();

    // Attempting to use the exact same secret for both License Key and @admin Password must keep button disabled
    await page.locator('#input-setup-license-key').fill('SameSecret2026!');
    await page.locator('#input-setup-license-confirm').fill('SameSecret2026!');
    await page.locator('#input-setup-admin-password').fill('SameSecret2026!');
    await page.locator('#input-setup-admin-password-confirm').fill('SameSecret2026!');
    await expect(setupBtn).toBeDisabled();

    // Providing a distinct valid commercial license key and admin password enables activation
    await page.locator('#input-setup-license-key').fill('CIOB-LIC-2026-ATELIER-01');
    await page.locator('#input-setup-license-confirm').fill('CIOB-LIC-2026-ATELIER-01');
    await page.locator('#input-setup-admin-password').fill('AdminStrongPass2026!');
    await page.locator('#input-setup-admin-password-confirm').fill('AdminStrongPass2026!');
    await expect(setupBtn).toBeEnabled();
  });

  test('4) Activates workstation with documented LOGIN-LICENSE-P0 test secrets, logs in via Dual-Key AND gate, and navigates to Stock PDR tab', async ({
    page,
  }) => {
    // Documented test secrets from src/tests/unit/loginLicenseP0.test.ts
    const TEST_LICENSE_KEY = 'CIOB-LIC-2026-ATELIER-01';
    const TEST_ADMIN_PASS = 'AdminStrongPass2026!';

    await page.goto('/');
    await advancePastBootScreens(page);

    // Step 1: First-run activation (PBKDF2 600k derivation for License + Admin)
    await page.locator('#input-setup-organization').fill('Atelier Test CIOB');
    await page.locator('#input-setup-license-key').fill(TEST_LICENSE_KEY);
    await page.locator('#input-setup-license-confirm').fill(TEST_LICENSE_KEY);
    await page.locator('#input-setup-admin-password').fill(TEST_ADMIN_PASS);
    await page.locator('#input-setup-admin-password-confirm').fill(TEST_ADMIN_PASS);

    const setupBtn = page.locator('#btn-setup-pin');
    await expect(setupBtn).toBeEnabled();
    await setupBtn.click();

    // Step 2: Wait for activation completion banner (#login-success-box) and Dual-Key AND Login Gate
    await expect(page.locator('#login-success-box')).toBeVisible({ timeout: 15_000 });
    const loginLicenseInput = page.locator('#input-login-license-key');
    await expect(loginLicenseInput).toBeVisible();

    await loginLicenseInput.fill(TEST_LICENSE_KEY);
    await page.locator('#input-login-password').fill(TEST_ADMIN_PASS);
    const submitBtn = page.locator('#btn-submit-credentials');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Step 3: Verify AuthenticatedApp MainLayout & Dashboard render
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('heading', { name: /Tableau de Bord & Pilotage Opérationnel/i })
    ).toBeVisible();

    // Step 4: Navigate to an operational tab (Magasin Stock & PDR) from Dashboard quick-access
    const stockModuleBtn = page.getByRole('button', { name: /Magasin Stock/i });
    await expect(stockModuleBtn).toBeVisible();
    await stockModuleBtn.click();
    await expect(mainContent).toContainText(/Stock|PDR|Catalogue|Article/i);
  });
});
