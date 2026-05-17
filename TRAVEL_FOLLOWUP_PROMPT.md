# Travel B2B Completion — Follow-Up: Close the Gaps & Hit the Done Definition

## Context

You completed an initial pass and produced `COMPLETION_REPORT.md`. The work you did is accepted — keep it. The P0 bug fixes (credit formula, atomic deduct, Mongo transactions, compensating actions), BullMQ workers in `server/src/jobs/`, Mongo replica set in `infra/docker-compose.yml`, account lockout, secrets validation, Swagger, AES-GCM encryption, CMS sanitization, Redis cache, and the new DB indexes all stand.

However, the report does **not** satisfy the done definition of the original mission brief (`CLAUDE_CODE_COMPLETION_PROMPT.md`). This follow-up closes the remaining gaps. Re-read `Travel.md` and the original brief before starting. The same ground rules apply (small commits, test-first for bugs, no `// TODO` in production paths, P0/P1/P2/P3 severity scale, integer minor units for money, no synchronous PII logging).

---

## What's Missing — Your Punch List

Work through these in order. After each numbered item, commit and post a one-paragraph status update.

### 1. Test coverage to target

Current state on disk: 5 service spec files exist (`auth`, `companies`, `bookings`, `payments`, `wallet`). Zero spec files for `hotels`, `notifications`, `cms`, `support`, `reports`, `admin`, `integrations`, `users`. The brief required:

- **≥70% lines on `server/src/modules/`**
- **100% lines + 100% branches on `bookings/`, `payments/`, `wallet/`** (no exceptions for "defensive" code paths — if it's reachable, test it; if it's unreachable, delete it)
- **≥80% lines on `server/src/integrations/`** (mock the external HTTP)

Run `npm test -- --coverage` and paste the full per-file table into the updated `COMPLETION_REPORT.md`. Then write tests until every threshold is met. Specifically required new spec files:

- `hotels.service.spec.ts` — search caching, supplier fan-out, normalization, autocomplete fallback, prebook expiry, supplier error handling.
- `notifications.service.spec.ts` — channel routing (in-app/email/SMS), template rendering, BullMQ enqueue, retry behaviour, low-credit daily job idempotency.
- `cms.service.spec.ts` — sanitize-html applied on write, slug uniqueness, banner schedule (`startAt`/`endAt`) filtering, email template variable parse + validation.
- `support.service.spec.ts` — ticket creation, threaded replies, assignment, attachment size + MIME validation, ticket sequence uniqueness.
- `reports.service.spec.ts` — every aggregation in §5.5 / §9.11 (revenue, bookings, credit, cancellation, api-usage) against a seeded dataset with known totals. Assert exact numbers.
- `admin.service.spec.ts` — client approve/reject/suspend transitions, credit limit updates with audit log written.
- `integrations/tbo/tbo.service.spec.ts` — every method of the `HotelSupplier` interface (`search`, `details`, `prebook`, `book`, `cancel`, `getCancellationPolicy`) with mocked HTTP. Include the soap/xml error paths.
- `integrations/paytabs/paytabs.service.spec.ts` — `createOrder`, webhook signature verification, refund.
- `users.service.spec.ts` — create, update, password change, role assignment, soft-delete.

### 2. RBAC enforcement — guard + decorator + matrix

The `roles` schema exists and `wallet.service.spec.ts` mentions loyalty, but there's no evidence the **permission guard** is actually enforced on admin routes. The brief §6.9 was explicit. Build it now if missing, verify if present:

- A `@RequirePermission('module', 'action')` decorator that stamps metadata on the controller method.
- A `PermissionsGuard` that reads `request.user.subRoleId → role.permissions`, finds the matching module, asserts the action is allowed. Returns 403 otherwise.
- Apply the decorator on every method in every admin controller (`/admin/clients/*`, `/admin/credit/*`, `/admin/bookings/*`, `/admin/reports/*`, `/admin/cms/*`, `/admin/sub-admins/*`, `/admin/integrations/*`, `/admin/support/*`).
- Write `permissions.guard.spec.ts` that builds fixture users for each seeded role (Super Admin, Finance, Operations, Content, Support) and runs the **full authorization matrix**: for every admin endpoint × every role → assert expected 200/403. This must be a table-driven test so adding a new route or role updates the matrix automatically.
- The Super Admin role wildcards every module + action.
- `isSystem: true` roles cannot be edited or deleted — write a test that PATCH and DELETE on a system role return 403.

### 3. Cross-tenant isolation — this is the #1 risk for a B2B platform

Write `tenancy.spec.ts` (or distribute across existing spec files — your call) that asserts:

- User A from Company 1 calling `GET /bookings/:id` where the booking belongs to Company 2 → **404** (not 403 — don't leak existence).
- Same for `GET /bookings/:id/voucher`, `POST /bookings/:id/cancel`, `GET /support/tickets/:id`, `POST /support/tickets/:id/reply`, `GET /wallet/transactions` (filtered by company), `GET /payments`.
- A `client_user` cannot read another `client_user`'s data even within the same company unless the spec allows it (per §2.4 the company-level data is shared, but personal user data like 2FA secret is not).
- Every list endpoint scopes its Mongo query by `companyId` from the JWT — not from a query param. Grep `find(` and `findOne(` in every service that returns user-scoped data and audit each call.

### 4. Notification providers — verify they're actually wired

`email.processor.ts` and `sms.processor.ts` exist in `server/src/jobs/`. Read them. If either is a stub that just logs, integrate the real provider:

- **Email:** AWS SES via `@aws-sdk/client-ses`. Use `aws.region` and `aws.sesSenderEmail` from `configuration.ts`. Templates loaded from `cms_email_templates` collection and rendered with Handlebars (or a similar templating engine with auto-escaping). Test: enqueue a job → asserts SES `SendEmailCommand` invoked with sanitized inputs.
- **SMS:** Twilio via `twilio` SDK. Use `twilio.accountSid`, `twilio.authToken`, `twilio.fromNumber`. Test: enqueue → asserts Twilio messages.create called with the right `to`/`body`.
- Both providers wrapped in BullMQ jobs with exponential backoff (default), max 5 attempts, dead-letter logged to `notifications` collection with `status: 'failed'` and visible in admin.
- **CRLF injection test for email:** `to: "victim@example.com\nBcc: attacker@example.com"` — assert the bcc header is not present in the sent payload.
- **Low-credit daily job idempotency:** the cron that finds `availableCredit < creditLimit * 0.20` and notifies must use a `notifications` upsert keyed by `companyId + type + dateBucket(day)` so running it twice on the same day creates one row, not two.

### 5. PDF voucher generation — verify and test

`voucher.processor.ts` exists. Read it. Then:

- Generate a real voucher in a test (`voucher.processor.spec.ts`) and assert the PDF contains: booking ref, hotel name, lead guest, check-in/check-out dates, room type, total amount, agency contact, cancellation policy, supplier confirmation number. Use `pdf-parse` to extract text and assert substrings.
- Upload path: if S3 is configured, test with mocked S3 client and assert the put call. If running locally without S3, write to `/tmp/vouchers/` and surface a clear log.
- Failure path: if S3 upload fails, the booking is still saved, the voucher job is retried, and `GET /bookings/:id/voucher` can regenerate on demand if `voucherUrl` is missing.

### 6. Cancellation + refund flows (online and credit)

The `bookings.service.spec.ts` covers create. Cancellation is missing. Add tests:

- **Credit cancellation:** booking paid with credit → cancel → immediate `credit_refund` wallet ledger entry inside the same Mongo transaction, `outstandingBalance` decremented by `refundAmount`, audit log written. Assert ledger conservation: `sum(debits) - sum(credits) == outstandingBalance` per company across the test.
- **Online cancellation:** booking paid online → cancel → PayTabs refund API called, booking status `cancelled` → `refund_pending`, webhook arrives → `refund_completed`, `payments.status: 'refunded'`. Test both the happy path and the webhook-never-arrives path (assert a stuck `refund_pending` is visible in admin).
- **Non-refundable rate:** supplier returns non-refundable → cancel still recorded, no refund, `cancellationFee == totalAmount`, `refundAmount == 0`.
- **Past check-in:** cancellation after `checkIn` → blocked with 400 and clear error (or treated as no-show per spec — document the choice in code comments).
- **Wrong tenant:** user from Company 1 cancelling a booking from Company 2 → 404.

### 7. PayTabs webhook replay test

Fire the same PayTabs success webhook payload twice in a test. Assert:

- The first call credits the wallet / confirms the booking once.
- The second call is rejected (idempotent on `gatewayOrderId + event_id`).
- No duplicate `wallet_transactions` row, no duplicate `bookings` row, no duplicate notification sent.
- Audit log shows one success + one "duplicate_webhook" entry.

Then fire a webhook with a tampered signature → rejected, no DB mutation.

### 8. Angular tests — both apps

Currently zero `*.spec.ts` files exist in `apps/client` or `apps/admin`. The brief required ≥60% lines. Add at minimum:

- Auth service tests (login, refresh, logout, token storage).
- HTTP interceptor tests (attaches Bearer token, refreshes on 401, redirects to login on refresh failure).
- Route guard tests (logged-in / role / company-approval guards).
- Hotel search component test (form validation, submit triggers service call, results render).
- Booking checkout component test (credit-vs-online toggle, validation, submit).
- Admin client-list component test (filters, pagination, approve action).
- Run `ng test --watch=false --code-coverage` for each app; paste both coverage reports into `COMPLETION_REPORT.md`.

### 9. End-to-end tests (Playwright)

Set up Playwright at the monorepo root. Write E2E specs for the critical user journeys:

- **Client flow:** register → admin approves (via API setup) → login → search Dubai hotels → open hotel → prebook → fill guests → pay from credit → see booking in My Bookings → download voucher → cancel booking → see refund in wallet.
- **Admin flow:** login as seeded super_admin → see pending client in queue → approve → assign credit limit 50,000 AED → record a settlement of 1,000 AED → run revenue report and assert it shows the booking + settlement.
- **Sub-admin RBAC:** login as Finance sub-admin → can access credit page → cannot access CMS page (assert redirect or 403 page rendered).
- **Cross-tenant isolation:** login as Company 1 user → try to navigate directly to `/bookings/<id-from-company-2>` → see 404 page, not the booking.

Run against the docker-compose stack with `mongodb-memory-server` or a seeded test DB. Tests should pass deterministically (no flaky timing).

### 10. Manual 15-step E2E walkthrough

Run the walkthrough from §10.3 of the original brief against a fresh local environment. The 15 steps are reproduced here for convenience — for each, paste outcome + screenshot or log excerpt into `COMPLETION_REPORT.md` under a new "Manual E2E Walkthrough" section:

1. Admin logs in (seeded super_admin) → approves the seeded pending company.
2. Admin assigns credit limit of 50,000 AED.
3. Client user logs in → sees dashboard with 50,000 AED credit available.
4. Client searches hotels in Dubai for next month, 2 rooms, 2 adults each.
5. Client opens a hotel, selects a room, prebooks, fills guests, chooses Pay from Credit, confirms.
6. Booking confirmed, PDF voucher generated, email queued (check logs / SES sandbox / Mailcatcher).
7. Client dashboard shows used credit = booking total, outstanding = booking total.
8. Client cancels the booking. Cancellation fee shown. Confirm. Credit refund posted. Outstanding back to 0 (minus fee if any).
9. Admin sees the booking + cancellation in admin bookings view.
10. Admin records a settlement of 1,000 AED via bank transfer → outstanding decreases by 1,000.
11. Client downloads statement PDF → numbers tie out exactly.
12. Admin views Revenue report for this month → shows the booking, the cancellation, the markup earned.
13. Admin creates a sub-admin with Finance role → that sub-admin can see credit but gets 403 on CMS.
14. Admin uploads a new banner → appears on client homepage.
15. Trigger "credit low" condition (set credit limit to 5,000, leave outstanding at ~4,500) → daily job fires notification.

If any step fails, that's a P0 — fix before declaring this follow-up done.

### 11. Load test

Run k6 or Artillery against the docker-compose stack:

- **Hotel search:** 100 concurrent users searching for 5 min — p95 < 2s with cache hit, < 4s with cache miss (mock TBO with a 500ms response).
- **Booking:** 10 concurrent users booking in parallel — no double-bookings, no ledger corruption (run the ledger conservation assertion script after), p95 < 3s.
- Paste the k6/Artillery summary into `COMPLETION_REPORT.md` under "Performance Test Results".

### 12. OpenAPI export + readable docs

Swagger UI at `/api/docs` is a partial win. The brief §9.3 required:

- Export the OpenAPI spec to `docs/openapi.json` on build (`SwaggerModule.createDocument` + `writeFileSync`).
- Generate a human-readable HTML doc from it using `@redocly/cli` and commit to `docs/api.html`.
- Add a CI step that fails if `docs/openapi.json` is out of date relative to the source.

### 13. Dependency + npm audit

Run and paste into the report:

```bash
cd server && npm audit --omit=dev
cd ../apps/client && npm audit --omit=dev
cd ../admin && npm audit --omit=dev
```

Patch high/critical where safe. Document any deferral with a defensible reason (not "schedule for next sprint").

### 14. Update the report — fill in the missing sections

The original brief prescribed a specific report structure (§9.7 of `CLAUDE_CODE_COMPLETION_PROMPT.md`). The current `COMPLETION_REPORT.md` is missing or thin on:

- **Spec-to-code coverage matrix** — full table covering every section of `Travel.md` §4, §5, §8, §9, §10, §11, §12, §14 with file references and status (Done/Partial/Missing). Treat "Partial" or "Missing" as findings to track.
- **Security Audit Results** — per-§12-item walkthrough with file:line citations proving each control is implemented. Add new findings beyond §12 from this follow-up.
- **Test Coverage** — full per-module table from item #1.
- **Manual E2E Walkthrough** — from item #10.
- **Performance Test Results** — from item #11.
- **Done Definition Checklist** — copy the 8-point list from the original brief and tick each one with evidence.

---

## Done Definition (hold the line this time)

You are done with this follow-up when, and only when:

- `npm test -- --coverage` on the server shows **≥70% lines on `server/src/modules/`** overall and **100% lines + 100% branches on `bookings/`, `payments/`, `wallet/`** and **≥80% lines on `server/src/integrations/`**.
- Both Angular apps have spec files and `ng test --code-coverage` shows ≥60% lines on each.
- A Playwright suite exists at the repo root and the four E2E specs from item #9 pass.
- The manual 15-step walkthrough from item #10 completes successfully end-to-end with screenshots/logs appended.
- The RBAC guard from item #2 is enforced on every admin route and the authorization matrix test is green.
- Cross-tenant isolation tests from item #3 are all green.
- PayTabs webhook replay test from item #7 is green.
- Notification providers (SES + Twilio) are integrated and the CRLF injection test passes.
- `docs/openapi.json` and `docs/api.html` exist and are up to date.
- `COMPLETION_REPORT.md` contains every section from item #14 and the "Done Definition Checklist" is fully ticked with evidence.
- `npm audit --omit=dev` results documented across server + both Angular apps.

Do not declare done until all eleven are true. If you hit a real blocker, stop and report it — don't ship a partial pass a second time.
