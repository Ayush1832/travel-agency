# Travel B2B — Playwright E2E Setup + Four Critical Flows

Set up Playwright at the monorepo root and write the four E2E specs from `TRAVEL_FINAL_VERIFICATION.md` item #7. This is scoped: do **only** these four specs, do not expand into smaller component tests (those are already covered by the Angular `*.spec.ts` suites you added).

## Setup

1. Install Playwright at the repo root: `npm init playwright@latest -- --quiet --browser=chromium`.
2. Choose TypeScript, tests folder `e2e/`, default config, no GitHub Actions step (we'll wire that separately).
3. Configure `playwright.config.ts` with `webServer` blocks that boot:
   - The server (`npm run start --workspace=server`) on port 3000 with `MONGO_URI` pointing at a dedicated test database (e.g., `travel-b2b-e2e`)
   - The Angular client on port 4200
   - The Angular admin on port 4201
   - `reuseExistingServer: !process.env.CI`
4. Add an `e2e/global-setup.ts` that:
   - Resets the e2e Mongo database (drop + reseed)
   - Runs the seed script to create the super-admin and the pending test company
   - Stubs TBO with a local mock (use `msw` or a thin Express side-server on port 5099 that returns a fixed hotel/prebook/book/cancel response set) — set `TBO_API_URL=http://localhost:5099` in the test env
   - Stubs PayTabs the same way — set `PAYTABS_API_URL=http://localhost:5099/paytabs` and return a deterministic "success" for `createOrder` + verifiable signature for webhook calls

If using a TBO mock is more work than it's worth, use the existing `tbo.service.spec.ts` fixture data and inject the mock at the NestJS provider level via an `E2E_USE_TBO_MOCK=true` env flag that swaps `TboService` for a fake in `IntegrationsModule`. Pick whichever is cleaner.

## Spec 1 — Client booking flow (`e2e/client-booking-flow.spec.ts`)

Single test that walks the full happy path. Each step is an `await test.step('description', async () => {...})` block so failures pinpoint the right place.

1. As an unauthenticated user, register a new company (email/phone/name/tax ID/password) on `/register`. Land on a "pending approval" page.
2. Via API (admin token from global setup), approve the company and set credit limit to 50,000 minor units of AED * 100 = 5,000,000.
3. Log in as the company's owner user.
4. Land on the dashboard. Assert credit balance card reads "5,000,000" (or formatted "AED 50,000.00").
5. Click Search. Enter destination "Dubai", checkIn = today + 7, checkOut = today + 9, 1 room, 2 adults.
6. Submit. Assert results page shows at least 1 hotel (from the mock).
7. Click first hotel → details page renders.
8. Click "Select Room" on the first room → checkout page renders with the rate locked.
9. Fill lead-guest name and email. Choose "Pay from Credit". Accept cancellation policy. Click "Confirm & Pay".
10. Land on booking confirmation page. Assert booking reference matches `/^BK-\d{4}-\d{6}$/`.
11. Click "Download Voucher". Assert a PDF downloads (check the download event, then `expect(download.suggestedFilename()).toMatch(/\.pdf$/)`).
12. Navigate to "My Bookings". Assert the new booking appears with status "confirmed" and the correct amount.
13. Click "Cancel Booking". Assert cancellation fee shown matches the mock policy. Confirm.
14. Booking status updates to "cancelled". Navigate to Wallet. Assert a `credit_refund` ledger entry exists for the refunded amount.
15. Dashboard credit balance returns to the original value (minus any non-refundable cancellation fee per the mock policy).

## Spec 2 — Admin operational flow (`e2e/admin-operational-flow.spec.ts`)

1. Log in as the seeded super_admin on the admin app.
2. Navigate to Clients. Filter by status=pending. See the seeded pending company (from the global setup, before Spec 1 ran — make sure global setup creates a second pending company for this spec or that this spec runs in its own DB scope).
3. Click into the company. Click Approve. Assert it moves to "active".
4. Open the credit page. Set credit limit to 100,000. Save. Assert success toast and the new value displayed.
5. Open the settlement page. Record a settlement of 5,000 via bank_transfer with reference "TEST-001". Save.
6. Assert outstanding decreased by 5,000 and a `settlements` row exists (check via API call from the test using the admin token).
7. Navigate to Reports → Revenue. Set date range = last 30 days. Submit.
8. Assert the report renders with the seeded test booking's revenue included (you'll need this spec to depend on Spec 1 having run first, or to seed a booking via API in this spec's beforeAll).
9. Click "Export CSV". Assert a CSV downloads, parse it, assert it contains the seeded booking row.

## Spec 3 — Sub-admin RBAC (`e2e/sub-admin-rbac.spec.ts`)

1. Via API setup, create a sub-admin user with the seeded "Finance" role.
2. Log in as that sub-admin.
3. Navigate to `/credit`. Assert the page renders normally (200 + credit table visible).
4. Navigate to `/cms/pages`. Assert one of:
   - Redirected to `/forbidden` or `/dashboard`, OR
   - Page renders a "403 Forbidden" component
   Whichever the app does. Document the behavior with a comment in the spec.
5. Open browser devtools (via `page.on('response')` listener) and capture the response to any `/api/admin/cms/*` request the page tried to make. Assert the status is 403.
6. Repeat for /api/admin/sub-admins → 403, /api/admin/integrations → 403. Each route the Finance role shouldn't access must return 403, not 200 + empty data.

## Spec 4 — Cross-tenant isolation (`e2e/cross-tenant-isolation.spec.ts`)

1. Via API setup, create Company A and Company B, each with one user.
2. As Company A's user, create a booking (mock + credit-pay flow shortened to an API call rather than the full UI — this spec is about isolation, not the booking flow).
3. Capture Company A's booking `_id` from the API response.
4. Log out. Log in as Company B's user.
5. Navigate directly to `/bookings/<companyA-booking-id>`. Assert the page renders a "Not Found" component or a 404 error UI — NOT the booking details.
6. Capture the API response from the underlying `/api/v1/bookings/:id` call. Assert status is 404, not 403 (don't leak existence) and not 200 (don't leak data).
7. Repeat for `/api/v1/bookings/<id>/voucher` → 404.
8. Repeat for `/api/v1/support/tickets/<companyA-ticket-id>` (create one in setup) → 404.

## Run + report

```bash
npx playwright test
```

Paste the result summary (suites, tests, passed/failed, duration) into `COMPLETION_REPORT.md` under a new section "Playwright E2E Results". Include each spec name and its pass/fail count.

If any spec fails because of a real bug in the app (not a flaky timing issue), that's a P1 — fix it, re-run, document both the bug and the fix. If a spec fails because the mock setup is wrong, fix the mock, not the spec.

## Done when

1. `playwright.config.ts` exists with webServer blocks for all three apps.
2. Global setup boots the mocks and seeds the DB cleanly.
3. All four spec files exist with the steps above.
4. `npx playwright test` passes all four.
5. Results appended to `COMPLETION_REPORT.md`.

After this, only two items remain on the original verification list: ledger conservation script and k6 load test. Both are quick. Project is one short session away from shippable.
