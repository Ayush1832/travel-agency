/**
 * Shared E2E helpers — API calls, auth, seed data loading.
 */

import * as fs from 'fs';
import * as path from 'path';
import { APIRequestContext, request } from '@playwright/test';

const API_BASE = 'http://localhost:3000/api/v1';
export const CLIENT_URL = 'http://localhost:4200';
export const ADMIN_URL = 'http://localhost:4201';

// ── Seed data ─────────────────────────────────────────────────────────────────

export function loadSeed() {
  const file = path.join(__dirname, 'seed-data.json');
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as {
    superAdmin: { email: string; password: string; id: string };
    pendingCompany: { id: string; name: string; user: { email: string; password: string; id: string } };
    financeSubAdmin: { email: string; password: string };
    companyA: { id: string; name: string; user: { email: string; password: string; id: string } };
    companyB: { id: string; name: string; user: { email: string; password: string; id: string } };
  };
}

// ── API helpers (no browser — uses raw HTTP) ──────────────────────────────────

export async function apiLogin(ctx: APIRequestContext, email: string, password: string) {
  const res = await ctx.post(`${API_BASE}/auth/login`, {
    data: { email, password },
  });
  if (!res.ok()) throw new Error(`Login failed (${res.status()}): ${await res.text()}`);
  // Server sets HTTP-only cookies; for API context we read the token from the cookie header
  const cookies = res.headers()['set-cookie'] ?? '';
  const match = cookies.match(/access_token=([^;]+)/);
  return match ? match[1] : '';
}

export async function apiGet(ctx: APIRequestContext, path: string, token: string) {
  return ctx.get(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function apiPost(ctx: APIRequestContext, path: string, body: object, token: string) {
  return ctx.post(`${API_BASE}${path}`, {
    data: body,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function apiPatch(ctx: APIRequestContext, path: string, body: object, token: string) {
  return ctx.patch(`${API_BASE}${path}`, {
    data: body,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

// ── Browser-based login helpers ───────────────────────────────────────────────

import { Page } from '@playwright/test';

export async function loginAsClient(page: Page, email: string, password: string) {
  await page.goto(`${CLIENT_URL}/auth/login`);
  await page.locator('input[formControlName="email"]').fill(email);
  await page.locator('input[formControlName="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  // Wait for redirect away from login page
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 15_000 });
}

export async function loginAsAdmin(page: Page, email: string, password: string) {
  await page.goto(`${ADMIN_URL}/auth/login`);
  await page.locator('input[formControlName="email"]').fill(email);
  await page.locator('input[formControlName="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 15_000 });
}

// ── Date helpers ──────────────────────────────────────────────────────────────

export function isoDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}
