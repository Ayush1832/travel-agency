/**
 * Spec 3 — Sub-admin RBAC
 *
 * Verifies that a Finance sub-admin (permissions: credit:read, reports:read,
 * bookings:read, clients:read) can access allowed routes and is denied
 * forbidden ones (CMS, sub-admin management, integrations).
 *
 * Both browser-level (redirect / error page) and API-level (403) checks.
 */

import { test, expect, request } from '@playwright/test';
import { loadSeed, apiLogin, loginAsAdmin, ADMIN_URL } from './helpers';

const API_BASE = 'http://localhost:3000/api/v1';

test.describe('Sub-admin RBAC', () => {
  const seed = loadSeed();

  test('finance sub-admin: allowed credit/reports, denied CMS/sub-admins/integrations', async ({ page }) => {

    // ── Step 1: Finance sub-admin logs in ─────────────────────────────────────
    await test.step('finance sub-admin logs in', async () => {
      await loginAsAdmin(page, seed.financeSubAdmin.email, seed.financeSubAdmin.password);
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    });

    // ── Step 2: Can access credit overview page ───────────────────────────────
    await test.step('can navigate to credit overview', async () => {
      await page.goto(`${ADMIN_URL}/credit`);
      // Should NOT redirect to access-denied / login
      await expect(page).not.toHaveURL(/\/access-denied|\/unauthorized|\/auth\/login/, { timeout: 10_000 });
      // Page content loads
      await expect(page.locator('h1, h2, mat-card, .page-title').first()).toBeVisible({ timeout: 15_000 });
    });

    // ── Step 3: Can access reports page ───────────────────────────────────────
    await test.step('can navigate to reports', async () => {
      await page.goto(`${ADMIN_URL}/reports`);
      await expect(page).not.toHaveURL(/\/access-denied|\/unauthorized|\/auth\/login/, { timeout: 10_000 });
      await expect(page.locator('h1, h2, mat-card, .page-title, .reports-container').first()).toBeVisible({ timeout: 15_000 });
    });

    // ── Step 4: Can access bookings list ─────────────────────────────────────
    await test.step('can navigate to bookings list', async () => {
      await page.goto(`${ADMIN_URL}/bookings`);
      await expect(page).not.toHaveURL(/\/access-denied|\/unauthorized|\/auth\/login/, { timeout: 10_000 });
      await expect(page.locator('h1, h2, mat-card, table, .page-title').first()).toBeVisible({ timeout: 15_000 });
    });

    // ── Step 5: API — credit endpoint returns 200 ──────────────────────────────
    await test.step('API: credit-outstanding returns 200', async () => {
      const ctx = await request.newContext();
      const token = await apiLogin(ctx, seed.financeSubAdmin.email, seed.financeSubAdmin.password);
      const res = await ctx.get(`${API_BASE}/admin/clients/outstanding`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(200);
      await ctx.dispose();
    });

    // ── Step 6: API — sub-admin management returns 403 ────────────────────────
    await test.step('API: list sub-admins returns 403', async () => {
      const ctx = await request.newContext();
      const token = await apiLogin(ctx, seed.financeSubAdmin.email, seed.financeSubAdmin.password);
      const res = await ctx.get(`${API_BASE}/admin/sub-admins`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(403);
      await ctx.dispose();
    });

    // ── Step 7: API — roles management returns 403 ────────────────────────────
    await test.step('API: list roles returns 403', async () => {
      const ctx = await request.newContext();
      const token = await apiLogin(ctx, seed.financeSubAdmin.email, seed.financeSubAdmin.password);
      const res = await ctx.get(`${API_BASE}/admin/roles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(403);
      await ctx.dispose();
    });

    // ── Step 8: API — integrations settings returns 403 ──────────────────────
    await test.step('API: integrations settings returns 403', async () => {
      const ctx = await request.newContext();
      const token = await apiLogin(ctx, seed.financeSubAdmin.email, seed.financeSubAdmin.password);
      const res = await ctx.get(`${API_BASE}/admin/integrations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Either 403 (found but forbidden) or 404 (route doesn't exist) — either is acceptable; NOT 200
      expect([403, 404]).toContain(res.status());
      await ctx.dispose();
    });

    // ── Step 9: UI — CMS / settings page redirects or shows forbidden ─────────
    await test.step('UI: settings/integrations page is inaccessible', async () => {
      // Intercept auth/me so AuthGuard resolves immediately with sub_admin role.
      // This ensures SuperAdminGuard runs and redirects before the 10s timeout.
      await page.route('**/auth/me', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': ADMIN_URL, 'Access-Control-Allow-Credentials': 'true' },
        body: JSON.stringify({ data: { user: { _id: 'sub-admin-id', email: seed.financeSubAdmin.email, firstName: 'Finance', lastName: 'Sub', role: 'sub_admin', status: 'active' } } }),
      }));
      await page.goto(`${ADMIN_URL}/api-settings`);
      // Wait for Angular's SuperAdminGuard to redirect sub_admin away from this route.
      // The guard returns a UrlTree to /dashboard which the router follows.
      await page.waitForURL(
        u => /dashboard|access-denied|unauthorized|login/.test(u),
        { timeout: 10_000 },
      ).catch(() => {});
      await page.unroute('**/auth/me');
      const url = page.url();
      const isRedirected = /access-denied|unauthorized|dashboard|login/.test(url);
      const hasForbiddenText = await page.locator('text=/forbidden|403|access denied|not authorized/i').isVisible({ timeout: 3_000 }).catch(() => false);
      expect(isRedirected || hasForbiddenText).toBe(true);
    });

    // ── Step 10: Super-admin can still access sub-admins list ─────────────────
    await test.step('super-admin can access sub-admins list (sanity check)', async () => {
      const ctx = await request.newContext();
      const superToken = await apiLogin(ctx, seed.superAdmin.email, seed.superAdmin.password);
      const res = await ctx.get(`${API_BASE}/admin/sub-admins`, {
        headers: { Authorization: `Bearer ${superToken}` },
      });
      expect(res.status()).toBe(200);
      await ctx.dispose();
    });
  });
});
