import { test, expect } from '@playwright/test';

test.describe('CIOB GMAO v4 - Core E2E & SSOT Verification', () => {
  test('Loads application shell and verifies API health & Swagger docs endpoint', async ({ page, request }) => {
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
});
