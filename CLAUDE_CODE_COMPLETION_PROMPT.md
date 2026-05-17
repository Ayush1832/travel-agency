# Claude Code Mission Brief — Travel Agency B2B Platform: Completion, Hardening & Sign-Off

## 0. Read This First

You are completing, auditing, and shipping a **B2B hotel booking platform** for the client. Spec lives at `Travel.md` in repo root — that is the source of truth. A previous Claude Code session scaffolded most of the project. Your job is to **prove what works, fill what's missing, fix what's broken, and harden everything to production quality**.

This is **business-critical, money-handling software**:

- Real B2B clients book hotels via this platform.
- Money flows through PayTabs payment gateway and an internal credit/wallet ledger.
- Bookings hit a live supplier API (TBO). A bug here means either a guest shows up to a hotel with no reservation, or the client gets double-charged. Both are unacceptable.
- The admin manages credit limits, settlements, and revenue reports — wrong numbers cost the business directly.

Treat every finding with that severity.

---

## 1. What's Already in the Repo (Verified)

**Monorepo layout:**

```
travel-agency/
├── apps/
│   ├── client/   — Angular client website (features: auth, dashboard, hotels, bookings, wallet, support)
│   └── admin/    — Angular admin panel (features: auth, dashboard, clients, credit, bookings, reports, cms, sub-admins, api-settings, support)
├── packages/
│   └── shared-types/   — booking, company, user, common types
├── server/
│   └── src/
│       ├── modules/    — auth, users, companies, hotels, bookings, payments, wallet, notifications, cms, support, reports, admin, integrations
│       ├── integrations/ — tbo (hotel supplier), paytabs (payment gateway)
│       ├── db/schemas/ — companies, users, roles, bookings, payments, wallet-transactions, settlements, notifications, cms-page, cms-banner, cms-email-template, support-tickets, api-config, audit-logs, loyalty-rule, booking-sequence, ticket-sequence
│       ├── common/     — guards, filters, decorators, interceptors, types
│       ├── config/     — configuration.ts + validation.ts
│       ├── jobs/       — EMPTY (BullMQ workers not implemented)
│       └── seeds/      — seed-admin.ts only
└── infra/docker-compose.yml — mongo + redis + server
```

**Stack confirmed:** NestJS 11 + Mongoose 9 + MongoDB 7 + Angular (in `apps/`) + Redis + Throttler + Helmet + JWT + bcrypt + Joi + class-validator + PDFKit + ExcelJS + xml2js (TBO is SOAP-based).

**Defaults observed in `configuration.ts`:** AWS region `me-south-1`, default currency `AED`, PayTabs region `ARE`. So this is a **UAE/MENA-region deployment** — keep that in mind for SES sender domains, data residency, currency rounding, and any locale-specific behaviour.

**Pre-existing gaps you must verify and close (see Phase 1):**

- `jobs/` directory is empty. Spec calls for BullMQ workers for voucher PDF generation, email/SMS dispatch, settlement reminders, and report exports. Either find them in another location, or implement them.
- Only one `*.spec.ts` exists (`app.controller.spec.ts`). Real coverage must be built.
- No Terraform / IaC files. Spec calls them optional but lists AWS production deployment as a deliverable — at minimum, document the manual setup as a runbook.
- `loyalty-rule.schema.ts` exists but no loyalty module exists — either orphaned (delete) or unfinished (build the module). Decide and document.
- No SES/SendGrid client wired up despite notifications being a deliverable. Check if Nodemailer or AWS SDK is integrated; if not, integrate.
- No Twilio/MSG91 client wired up despite SMS being a deliverable. Same as above.
- README is still the default NestJS starter template — must be replaced with a real project README.

---

## 2. Your Mission (Non-Negotiable Outcomes)

By the time you finish:

1. The project **builds cleanly** — both backend (`server/`) and both Angular apps (`apps/client/`, `apps/admin/`) — with zero TS errors, zero ESLint errors, zero meaningful warnings.
2. **Every module in `Travel.md` §3–§5 is fully implemented end-to-end.** Not stubbed, not "TODO" — implemented.
3. **Every REST endpoint in `Travel.md` §9 exists, is wired to a handler, has DTO validation, has RBAC enforcement, and is documented in Swagger/OpenAPI.**
4. **Every workflow in `Travel.md` §10 works manually and is covered by an integration or E2E test** — especially compensating actions for "BOOK API fails after payment captured".
5. **Every security requirement in `Travel.md` §12 is implemented and verifiable.** Show me where in the code.
6. **Test coverage:** ≥70% lines on `server/src/modules/`; **100% line + branch** on anything that touches money (bookings, payments, wallet, settlements).
7. A **`COMPLETION_REPORT.md`** at repo root summarizing every gap found, every fix applied, every remaining risk, and proof of verification.
8. A real **`README.md`** at repo root (replace the NestJS starter), plus `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/RUNBOOK.md`.

Do not declare done until all eight are true.

---

## 3. Ground Rules

- **Don't guess. Read the code.** The spec is detailed; mismatches between spec and code are bugs. Read every module's controller + service + DTOs end-to-end before declaring it "done".
- **Don't ship `// TODO` in production paths.** If you must defer something, add a P1/P2 entry in the report and a clear comment with the issue link.
- **Don't break the modular monolith.** Stay inside the existing folder structure. If you need a new module, follow NestJS conventions (`*.module.ts` + `*.controller.ts` + `*.service.ts` + `dto/`).
- **Money math is integers (minor units / fils-paise-cents).** Spec §8 requires this. Any `parseFloat` or naked `Number()` on a currency value is a bug — fix and add a test.
- **All money mutations are inside Mongoose transactions** (replica set required — use Atlas or set up a single-node replica in docker-compose for local dev). No exceptions. Wallet, payment capture, booking confirmation, settlement, and refund flows must all be atomic.
- **All Mongo writes that depend on a prior read are guarded with optimistic concurrency or conditional updates** (e.g., decrement credit only `where: { availableCredit: { $gte: amount } }`). No read-modify-write races on financial fields.
- **Never log raw card data, full JWT tokens, passwords, raw API keys, or PII beyond what's required for an audit trail.** Hash or redact.
- **All API keys and secrets** load from env vars (`server/.env` for dev, AWS Secrets Manager for prod). No hardcoded secrets, no committed `.env`. The defaults in `configuration.ts` like `access-secret-change-in-prod` must hard-fail in production (`NODE_ENV=production` + default secret → throw on boot).
- **Don't touch live PayTabs or TBO endpoints** during automated tests. Use the sandbox URLs already in config, and mock adapters in unit/integration tests. Only manual smoke runs hit sandbox.

---

## 4. Phase 1 — Gap Analysis & Static Audit

Do this **before** writing any new feature code. Output goes into `COMPLETION_REPORT.md` under "Discovery".

### 4.1 Spec-to-code coverage matrix

For each section of `Travel.md`, produce a table: **Spec item → File(s) implementing it → Status (Done / Partial / Missing) → Notes.** Cover:

- §2 Roles & permissions (super_admin, sub_admin, client_owner, client_user, role-based permissions matrix).
- §4 Every client website feature (4.1–4.10).
- §5 Every admin panel feature (5.1–5.9).
- §8 Every collection in §8.1–§8.12 with all listed fields and indexes from §8.13.
- §9 Every endpoint in §9.1–§9.15 (Auth, Hotels, Bookings, Payments, Wallet, Notifications, Support, Admin/Clients, Admin/Credit, Admin/Bookings, Admin/Reports, Admin/CMS, Admin/Sub-Admins & Roles, Admin/API-Configs, Admin/Support).
- §10 Every workflow (10.1 online book, 10.2 credit book, 10.3 cancellation + refund, 10.4 settlement, 10.5 sub-admin perm check).
- §11 Integrations (hotel supplier adapter interface, payment gateway adapter, Google Maps, email, SMS).
- §12 Every security requirement.

For each "Partial" or "Missing" row, file a task with severity P0–P3 (see §8 below).

### 4.2 Build & lint

```bash
# Root
npm ci

# Server
cd server
npm ci
npx tsc --noEmit
npx eslint "src/**/*.ts"
npm run build

# Client
cd ../apps/client
npm ci
npx ng lint
npx ng build --configuration production

# Admin
cd ../admin
npm ci
npx ng lint
npx ng build --configuration production
```

Every error and every warning that signals real risk (unused awaits, floating promises, `any` on financial values, missing null checks on Mongoose results) gets fixed. Do **not** suppress warnings with `// eslint-disable-next-line` unless you can justify it in a code comment.

### 4.3 Dependency audit

```bash
cd server && npm audit --omit=dev
cd ../apps/client && npm audit --omit=dev
cd ../admin && npm audit --omit=dev
```

Triage high/critical. Patch where safe; document where not.

### 4.4 Secret scan

```bash
git log -p | grep -iE '(api[_-]?key|secret|password|token|bearer)\s*[:=]' | head -100
```

Plus look at `*.env*` files in git history. Any committed secret = P0 finding, rotate immediately, document the rotation in the report.

### 4.5 Confirm orphaned files

- `loyalty-rule.schema.ts` — is there a module for it? If not, decide: build it (if MVP-scoped) or delete it.
- `jobs/` empty — is queue work happening elsewhere (e.g., synchronously in services)? If yes, that's an architectural issue: PDF generation and email sends should not block the request thread.
- Any `*.controller.spec.ts` that's just the default stub — delete or replace with a real test.

---

## 5. Phase 2 — Environment & Build-Up

### 5.1 Reproducible local stack

`infra/docker-compose.yml` brings up mongo + redis + server. Verify it works:

```bash
cd infra
docker compose up -d
docker compose logs -f server
```

Add a `mongo` healthcheck and make `server` `depends_on` it with `condition: service_healthy`. Configure Mongo as a **single-node replica set** so multi-document transactions work locally (the spec requires atomic credit + booking writes):

```yaml
mongo:
  command: ["--replSet", "rs0", "--bind_ip_all"]
  healthcheck:
    test: ["CMD-SHELL", "mongosh --quiet --eval 'rs.status().ok || rs.initiate({_id:\"rs0\",members:[{_id:0,host:\"mongo:27017\"}]}).ok'"]
    interval: 5s
    retries: 20
```

### 5.2 Environment files

Create `server/.env.example` with every variable referenced in `configuration.ts`. Add Angular env files too. Make sure secrets like `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PAYTABS_SERVER_KEY`, `TBO_API_KEY`, `AWS_SECRET_ACCESS_KEY`, `TWILIO_AUTH_TOKEN` are in `.env.example` with placeholder values and a comment explaining where to get them.

### 5.3 Seeds

`seed-admin.ts` seeds a super admin. Extend the seed system to also create:

- The default sub-admin roles from §5.7 (Finance, Operations, Content, Support) with permissions wired correctly.
- A sample test company in `pending` state for smoke testing approval flows.
- Sample CMS pages (About, Contact, Terms, Privacy, FAQ) with placeholder content.
- The default email templates (booking confirmation, cancellation, password reset, credit-low warning, outstanding reminder).

Idempotent — running the seed twice must not create duplicates.

### 5.4 Smoke run

Backend boots cleanly. Mongo + Redis connect. Throttler middleware active. Helmet applied. Both Angular apps load, hit `/api/v1/auth/me` for unauthenticated user → 401 (not 500). Login as the seeded super admin → JWT issued, `/api/v1/admin/clients` returns 200.

---

## 6. Phase 3 — Feature-by-Feature Completion & Testing

For each feature below: (a) verify it matches the spec, (b) fill any gaps, (c) write integration tests with `@nestjs/testing` + Supertest using a real Mongo via `mongodb-memory-server` or the docker compose stack. Add E2E tests using Playwright or Cypress for the critical user journeys.

### 6.1 Authentication & RBAC (`Travel.md` §4.1, §9.1, §10.5)

- All 9 auth endpoints from §9.1 present and wired (`register`, `login`, `logout`, `refresh`, `forgot-password`, `reset-password`, `verify-email`, `me`, `sessions/revoke-all`).
- Registration lands company in `status: 'pending'` — login refused until admin approves.
- JWT access (15 min) + refresh (7 days). Refresh tokens stored hashed in DB, rotated on use, old token invalidated immediately (replay → 401).
- Bcrypt cost ≥ 12. Password length capped (max 256) to prevent bcrypt DoS.
- Account lockout after N failed attempts (define and document — recommend 5 attempts → 15 min lock).
- Password reset token TTL 30 min, single-use, invalidated on use.
- Email verification flow works end-to-end (token in email → verify endpoint).
- 2FA scaffolding is **at least ready**: a `twoFactorEnabled` flag on user, with TOTP generate/enable/disable endpoints. If not in MVP, document as deferred.
- **RBAC middleware (guard) loads sub-admin role on every admin request and checks `module + action`** against the request route. Test: a "Finance" sub-admin hitting `/admin/cms/*` → 403. Test: client user hitting any `/admin/*` → 403.
- Every privileged action writes to `audit_logs` with actor, action, module, target, before/after diff, IP, user-agent.

### 6.2 Hotel Search & TBO Integration (§4.3, §4.4, §4.5, §9.2, §11.1)

- TBO adapter implements the **`HotelSupplier` interface from §11.1**: `search`, `details`, `prebook`, `book`, `cancel`, `getCancellationPolicy`. Verify each method exists.
- Search fans out to all `enabled` suppliers from `api_configs` in parallel via `Promise.allSettled`, normalizes responses via `normalized.types.ts`, dedupes, returns. If only TBO is active today, the architecture must support adding RateHawk/Hotelbeds/Hotelapi later without touching `hotels.service.ts`.
- Search results cached in Redis keyed by hash of `(destination, dates, rooms, pax, currency, nationality)` for 5 min.
- Autocomplete endpoint backed by either supplier autocomplete or a local destinations collection (build the latter as a fallback if missing).
- Filters (price slider, star rating, amenities, room types, meal plan, cancellation policy) and sorts work — most can be client-side, but server-side pagination must support `page`, `limit` (max 100).
- Hotel details page fetches per-room rates, cancellation policy per rate, photos, amenities, Google Maps lat/lng (geocode fallback if supplier doesn't return).
- **Prebook locks the rate** — test the unhappy path where prebook succeeds but user takes too long → next book attempt fails cleanly with a re-search prompt, not a 500.

### 6.3 Booking & Checkout (§4.6, §9.3, §10.1, §10.2) — **money-critical**

This is the most important section. Test exhaustively.

**Happy path (online):**

1. `POST /bookings` with `prebookToken` + guest info + `paymentMethod: 'online'` + `paymentId`.
2. Backend verifies payment with PayTabs (`/payments/verify`).
3. Backend calls `TBO.book(prebookToken, guests)`.
4. On success: insert booking in `bookings` collection, generate PDF voucher via PDFKit, upload to S3 (or local in dev), enqueue email via BullMQ, return booking with `voucherUrl`.
5. PDF voucher contains: booking ref, hotel, guest, dates, room, total, agency contact, cancellation policy, supplier confirmation number.
6. Booking ref format `BK-2026-000123` is unique — use the `booking-sequence` schema atomically (`findOneAndUpdate` with `$inc`).

**Compensating action — CRITICAL (§10.1 step 9):**

- If TBO `book` fails AFTER PayTabs has captured payment: auto-refund via PayTabs, set booking `status: 'failed'`, create a support ticket assigned to operations role, notify client. Write a test that simulates `TBO.book` throwing — payment is refunded, no booking row remains (or remains in `failed`), audit log records the compensating action, ticket created.
- If TBO `book` fails AFTER credit was deducted: rollback credit deduction within the same Mongo transaction, add a wallet `credit_refund` ledger entry, audit log records it.
- If S3 upload fails after booking is confirmed: booking still saved, voucher generation re-queued, no user-facing error. The voucher download endpoint must regenerate on demand if `voucherUrl` is missing.
- If voucher email fails: booking still saved, email re-queued with exponential backoff (BullMQ default), max retries 5, final-failure goes to a dead-letter list visible in admin.

**Concurrency tests:**

- Two requests trying to book the same prebook token in parallel → exactly one succeeds.
- Two parallel `POST /bookings` for the same company spending `availableCredit / 2 + 1` → exactly one succeeds (other gets `INSUFFICIENT_CREDIT`).
- Pool conservation: in any sequence of bookings, `sum(wallet_transactions debits) == sum(bookings.totalAmount where paymentMethod='credit')`. Add a script to verify the ledger.

**Edge cases:**

- Credit-pay with `availableCredit < total` → 400, no state mutation, no TBO call.
- Online pay with PayTabs returning "failed" status → no booking, no email, no audit-log marked as success.
- Same `gatewayOrderId` arriving twice on webhook → idempotent (unique index on `payments.gatewayOrderId`).
- Booking checkIn date in the past → 400 from DTO validation.
- Booking with 0 rooms or 0 guests → 400.
- Booking with more children than `childrenAges.length` → 400.

### 6.4 Cancellation & Refund (§4.7, §9.3, §10.3)

- `POST /bookings/:id/cancel` fetches the rate's cancellation policy (already on the booking), shows the fee, on confirm calls `TBO.cancel(supplierBookingRef)`.
- Online payment cancellation → PayTabs refund (async). Status moves through `cancelled` → `refund_pending` → `refund_completed` via webhook.
- Credit payment cancellation → immediate `credit_refund` wallet ledger entry inside a Mongo transaction. `outstandingBalance` decremented.
- Cancellation past check-in date → blocked or treated as no-show per policy. Define and document.
- Cancellation by client user on a booking they don't own → 403.
- Cancellation when supplier returns "non-refundable" → cancellation still recorded, no refund, status `cancelled` with `cancellationFee == totalAmount` and `refundAmount == 0`.
- Audit log entry on every cancel and every refund completion.

### 6.5 Wallet & Credit (§4.8, §5.3, §8.6, §9.5, §9.9, §10.4)

- Ledger correctness: every credit/debit creates exactly one `wallet_transactions` row with `balanceAfter`. Sum of `direction='credit' - direction='debit'` per company always equals `outstandingBalance` (or `walletBalance` for the relevant types).
- Top-up: client initiates `POST /wallet/topup` → PayTabs order → on success webhook → `walletBalance += amount` + ledger entry `type: 'topup'`. Idempotent on `gatewayOrderId`.
- Admin top-up (manual cash/bank transfer): `POST /admin/clients/:id/topup` → ledger entry `type: 'topup'` + `performedBy: adminId`. No payment row.
- Settlement: `POST /admin/clients/:id/settlement` → creates `settlements` doc + reduces `outstandingBalance` + creates ledger entry `type: 'settlement'`. Optional `appliedTo` array linking specific bookings.
- Statement download: `GET /wallet/statement?from=&to=` returns PDF and Excel, generated via BullMQ for large ranges.
- Outstanding aging: `GET /admin/outstanding` returns clients with buckets 0–30 / 31–60 / 61–90 / 90+ days, calculated server-side via aggregation.
- Send reminder: `POST /admin/outstanding/:companyId/remind` → enqueues email via template `outstanding_reminder`.
- Hard credit limit enforced: when `outstandingBalance + newBookingAmount > creditLimit + walletBalance`, booking blocked with clear error.

### 6.6 Notifications (§4.9, §9.6, §11.4)

- In-app: `notifications` collection + `GET /notifications` + WebSocket or polling for live updates. (If WebSocket not done, polling every 30s is acceptable for MVP — document the decision.)
- Email: AWS SES integrated. Templates rendered from `cms_email_templates` with handlebars-style placeholders. Queued via BullMQ. Retried on failure.
- SMS: Twilio integrated. Used for booking confirmations and OTP (if 2FA built). Queued. Retried.
- All five trigger events from §4.9 fire correctly: booking confirmed, cancelled, modified, payment received, payment failed, credit low (<20%), outstanding overdue, supplier-side modification.
- "Low credit" rule: a scheduled job (cron) runs daily, finds companies where `availableCredit < creditLimit * 0.20`, sends `credit_low` notification, idempotent per day (don't spam).
- All recipient PII (name, email) HTML-escaped in email templates. No template injection via user input.

### 6.7 Support Tickets (§4.10, §5.8, §9.7, §9.15)

- Client creates ticket, replies, sees thread. Optional attachment of `bookingRef`.
- Admin sees all tickets, filters by status/priority/category/assignee, assigns to sub-admin, replies.
- Email notification to the other party on every reply (queued).
- Ticket numbers use the `ticket-sequence` schema for uniqueness.
- File attachments scanned/sized (max 5MB, allowed MIME types only) and stored to S3.

### 6.8 CMS (§5.6, §9.12)

- Pages CRUD with rich-text body (TinyMCE/Quill on frontend; backend stores HTML). Sanitize HTML server-side with `sanitize-html` to prevent stored XSS — admins are trusted but defense in depth applies.
- Banners CRUD with image upload to S3, sort order, active flag, schedule (`startAt`/`endAt`).
- Email templates CRUD with variable validation — when saving, parse `{{variable}}` placeholders and store the schema so renders can fail fast on missing variables.
- Public endpoint serving published pages by slug for client-side rendering.

### 6.9 Sub-Admin Management & Roles (§5.7, §8.3, §9.13, §10.5)

- Define system roles (Finance, Operations, Content, Support) with `isSystem: true` — can't be edited/deleted.
- Define custom roles with arbitrary permission grids.
- Sub-admin CRUD; password set via invitation link (email with one-time token, not admin-set plaintext).
- The RBAC guard (already mentioned in 6.1) reads `subRoleId → role.permissions` and matches against the controller method's `@RequirePermission('module', 'action')` decorator. Build the decorator + guard if not present.
- Test matrix: for every admin endpoint, assert that each system role gets the expected 200/403.

### 6.10 Reports (§5.5, §9.11)

- Revenue: `bookings` aggregation grouped by period, joins `payments` for net realised. Gross vs net vs markup.
- Bookings: count by status, hotel, destination, client; time-bucketed.
- Credit: outstanding by client, settlements received, top-ups.
- Cancellation: count + value + top hotels by cancellation rate.
- API usage: hit counts, success/error rate, latency from `audit_logs` or a dedicated `api_metrics` collection (build it if missing — `integrations` should log every supplier call's duration and status).
- All reports filterable by `from`/`to`, exportable to CSV / Excel / PDF. Large exports (>5k rows) generated via BullMQ and emailed as a downloadable link.

### 6.11 API Integrations Settings (§5.9, §9.14)

- `GET /admin/integrations` returns the list of providers with masked keys (e.g., `pk_live_****1234`).
- `PATCH /admin/integrations/:provider` updates keys — keys stored AES-256 encrypted at rest using a `KEY_ENCRYPTION_SECRET` env var. Build an `EncryptionService` if missing.
- `POST /admin/integrations/:provider/test` runs a lightweight call (TBO: search a known city; PayTabs: list payment methods) and returns success/error.
- All key changes audited.

### 6.12 Admin Dashboard (§5.1)

- KPI endpoints return: total clients (active/pending/disabled), total bookings (today/month/year), revenue gross + commission, outstanding totals, top 10 clients by revenue, 30-day booking trend (array of `{date, count}`), cancellation rate.
- All aggregations cached in Redis for 60s to avoid hammering Mongo on dashboard refresh.

### 6.13 Client Dashboard (§4.2)

- Credit balance card, booking stats, recent activity (last 10), quick actions, outstanding warning if `outstandingBalance > 0` past due date.

---

## 7. Phase 4 — Security Audit (Adversarial Mindset)

Walk every item in `Travel.md` §12 and **prove it works** with a test or code citation. Beyond that, hunt for:

### 7.1 Auth & sessions

- JWT signed and verified with explicit algorithm (`HS256` or `RS256`) — never let `alg: none` slip through. Grep `jwt.verify` for any missing algorithm.
- JWT secrets are ≥ 32 bytes random in production. Boot-time check fails hard if the default `access-secret-change-in-prod` is loaded in production.
- Refresh token rotation invalidates the prior token immediately. Reuse → 401 + audit log "refresh_reuse_detected" + force-logout-all for that user.
- Logout actually revokes server-side (DB).
- Account lockout cannot be bypassed by switching login methods or resetting password.

### 7.2 Input validation

- Every controller method has DTO validation via `class-validator` + `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`. Anything reading raw `req.body.x` is a finding.
- All numeric money fields validated as positive integers with min/max.
- All Mongo ObjectId path params validated via a custom pipe.
- Mongoose injection (operators like `$gt` in user input) prevented — never pass `req.body` directly into a Mongoose query filter without DTO coercion.

### 7.3 Authorization

- Every authenticated route checks the user owns the resource (e.g., a client user can only fetch their own company's bookings). Try cross-tenant access in tests: User A from Company 1 fetching `bookings/:id` belonging to Company 2 → 404 (don't even leak existence with 403).
- Admin and owner middleware applied at controller-class or method level via decorators — no handler does its own ad-hoc check that can be bypassed.

### 7.4 Money & supplier integrations

- All money arithmetic on integer minor units. No `parseFloat`. Round only at the boundary (output to user) using `Intl.NumberFormat`.
- All multi-doc money writes inside `session.withTransaction()`.
- Optimistic concurrency on `availableCredit` decrements: `findOneAndUpdate({_id, outstandingBalance: priorValue}, {$inc: ...})` or use a conditional `$inc` with a `$where` clause.
- PayTabs webhook signature verified using `paytabs.serverKey` HMAC. Reject if missing/mismatched.
- TBO responses validated for required fields before persisting — never trust an upstream "success" with empty body.
- TBO and PayTabs raw responses stored in `apiRaw`/`raw` fields for debugging — but redact any PII (card data, full guest passport, etc.) before storage.

### 7.5 Rate limits & DoS

- Global throttler (already wired) limits 10/s, 50/10s, 200/min. Tighter limits on `/auth/login`, `/auth/register`, `/auth/forgot-password`: e.g., 5 per 15min per IP.
- Pagination capped at 100 on every list endpoint (server-side, not just default).
- Bcrypt cost 12 = ~250ms per hash. With password length cap, bcrypt-DoS is bounded.
- Hotel search endpoint: rate-limited per user (e.g., 30/min) — supplier APIs cost money per call.
- Any unbounded loop, `while (true)`, or recursion over user input is a finding.

### 7.6 Transport & headers

- Helmet middleware applied (verify). HSTS enabled for production. `noSniff`, `frameguard`, CSP appropriate for Angular SPA (allow `'unsafe-inline'` on style if Material requires it — document).
- CORS strict allowlist: only `CLIENT_APP_URL` and `ADMIN_APP_URL`. No `*`. Credentials only on cookie-based flows.
- Cookies (if using HTTP-only cookie pattern): `Secure`, `HttpOnly`, `SameSite=Strict` for refresh; `SameSite=Lax` only where needed.

### 7.7 Secrets & config

- `.env` gitignored. Confirm via `git log --all --full-history -- "*.env*"`.
- No secrets in frontend bundles. Search `apps/*/dist/` for known patterns after build.
- `KEY_ENCRYPTION_SECRET` used for `api_configs` encryption is read from env, never logged. Production setup uses AWS Secrets Manager — document in `RUNBOOK.md`.

### 7.8 Specific attack scenarios to attempt

- **Negative amount booking / negative top-up** — try `amount: -100`. Must be rejected.
- **Integer overflow on big amount** — try `amount: Number.MAX_SAFE_INTEGER`. Define max-booking cap (e.g., 1,000,000 minor units = 10,000.00). Reject above.
- **NaN/Infinity in numeric fields** — must be rejected by DTO.
- **NoSQL injection via email or company name** — `email: { $ne: null }`. Must be rejected by DTO coercion.
- **Stored XSS via CMS body or support ticket message** — must be sanitized on write (sanitize-html) and escape-on-render in Angular (Angular escapes by default; only `bypassSecurityTrustHtml` calls are dangerous — grep for them).
- **Webhook replay** — fire the same PayTabs success webhook twice. Wallet/booking must not double-credit. Idempotency key: `gatewayOrderId + event_id`.
- **Cross-tenant data access** — every test from §7.3 above.
- **Email enumeration** — `/auth/login` and `/auth/forgot-password` must respond identically whether email exists or not.
- **Role escalation via PATCH** — client user trying to PATCH their own role to `super_admin` must be rejected by DTO (role not in whitelist) and by guard.

---

## 8. Phase 5 — Fix Bugs

For every issue found:

1. Write a **failing test** that reproduces it.
2. Make the **smallest** code change that fixes the test without breaking others.
3. Re-run the full suite.
4. Add a row to `COMPLETION_REPORT.md` under "Fixes": severity, file:line, root cause, fix summary, test added.

**Severity scale:**

- **P0** — funds at risk, auth bypass, data loss, cross-tenant leak, secret exposure. Stop and fix before continuing.
- **P1** — feature broken, money math wrong, race condition with observable bad state, supplier compensating action missing.
- **P2** — error path wrong, edge case unhandled, missing validation, missing audit log.
- **P3** — code smell, missing test, minor UX issue, doc gap.

If a fix requires a schema migration with data backfill, document the migration script under `server/src/db/migrations/` and explain the run order in `RUNBOOK.md`. Mongoose has no first-class migration tool — use a hand-rolled script that's idempotent and runnable via `npm run migrate`.

---

## 9. Phase 6 — Documentation & Deliverables

### 9.1 Replace the NestJS starter README

`server/README.md` is still the default NestJS template. Replace it with a real one:

- What this service does in one paragraph.
- Local setup (clone → `npm ci` → `docker compose up` → `npm run start:dev`).
- Test commands.
- Env vars table (name, required, default, what it does).
- Module map (link to `docs/ARCHITECTURE.md`).

### 9.2 Repo-root `README.md` (new)

- What the platform is (B2B hotel booking).
- Monorepo layout.
- Quick start for each app (server / client / admin).
- Links to detailed docs.

### 9.3 `docs/API.md`

Auto-generated from `@nestjs/swagger`. Set up Swagger module in `main.ts` if absent. Every controller and DTO must have decorators (`@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiProperty`). Output the OpenAPI JSON to `docs/openapi.json` and a human-readable markdown via `redocly`.

### 9.4 `docs/ARCHITECTURE.md`

Diagram (ASCII or Mermaid) + module-by-module summary, data flow for the three critical workflows (online book, credit book, cancel + refund), explanation of the adapter pattern for suppliers and gateways.

### 9.5 `docs/DEPLOYMENT.md`

Step-by-step AWS production setup matching the spec:

- VPC + ALB + ECS Fargate (or EC2) for the API.
- MongoDB Atlas (or self-hosted with replica set — must be a replica set for transactions).
- ElastiCache Redis.
- S3 bucket for vouchers + attachments, with bucket policy.
- CloudFront in front of S3 and Angular static hosting.
- ACM cert + Route53.
- SES domain identity + DKIM.
- Secrets Manager wiring (which secrets, which IAM role reads them).
- GitHub Actions workflow that builds, tests, pushes Docker image to ECR, deploys to ECS.

Terraform is optional per spec but recommended. If you don't write Terraform, write a complete manual checklist.

### 9.6 `docs/RUNBOOK.md`

On-call playbook:

- How to check service health.
- How to read logs (CloudWatch query examples).
- How to handle the `[CRITICAL]` compensating-action log (booking succeeded but payment didn't refund, or vice versa).
- How to manually approve/reject a client.
- How to rotate API keys.
- How to restore Mongo from backup.
- How to drain a node before deployment.

### 9.7 `COMPLETION_REPORT.md`

Structure:

```
# Travel B2B Completion Report — <date>

## Executive Summary
- One paragraph: overall health, P0/P1 counts, what was fixed, what remains.

## Spec-to-Code Coverage Matrix
- Full table from Phase 1.

## Gaps Closed
- Per-gap entry: spec ref, prior state, what was added, files touched.

## Bug Fixes
- Per-fix entry: ID, severity, area, file:line, root cause, fix, test added.

## Security Audit Results
- Per-§12-item walkthrough with file:line citations.
- New findings beyond §12.

## Test Coverage
- Per-module coverage numbers.
- Total new test files added.

## Manual E2E Walkthrough (from §10 below)
- Step-by-step results with screenshots/log excerpts.

## Performance Test Results
- k6/Artillery report: search throughput, booking throughput, p95 latency.

## Deployment Readiness Checklist
- Each item from Travel.md §14 Deliverables, ticked or explicitly deferred.

## Remaining Risks
- Anything not fixed, with severity and recommended action.

## Recommendations
- Prioritized follow-up work (e.g., add more suppliers, switch to Stripe alongside PayTabs, build native mobile apps, add loyalty module).
```

---

## 10. Phase 7 — Final Verification

### 10.1 Automated checks (paste output into the report)

```bash
# Server
cd server
npx tsc --noEmit
npx eslint "src/**/*.ts"
npm test -- --coverage
npm run test:e2e

# Client
cd ../apps/client
npx ng lint
npx ng test --watch=false --code-coverage
npx ng build --configuration production

# Admin
cd ../admin
npx ng lint
npx ng test --watch=false --code-coverage
npx ng build --configuration production

# E2E
cd ../..
npx playwright test    # or cypress
```

**Coverage targets:**

- `server/src/modules/`: ≥ 70% lines, ≥ 60% branches.
- `server/src/modules/bookings/`, `payments/`, `wallet/`: **100% lines + 100% branches** (no exceptions).
- `server/src/integrations/`: ≥ 80% lines (mock the external HTTP).
- Angular apps: ≥ 60% lines (components rendered + key user flows in service tests).

### 10.2 Load test

Use k6 or Artillery to hit a deployed staging environment (or local docker stack with a beefier mongo):

- 100 concurrent users searching hotels for 5 minutes — p95 latency < 2s (cache hits) / < 4s (cache misses with TBO mock).
- 10 concurrent users booking simultaneously — no double-bookings, no ledger corruption, p95 < 3s.

Report results in `COMPLETION_REPORT.md`.

### 10.3 Manual end-to-end walkthrough

Fresh DB. Walk through:

1. Admin logs in (seeded super_admin) → approves the seeded pending company.
2. Admin assigns credit limit of 50,000 AED to the company.
3. Client user logs in → sees dashboard with 50,000 AED credit available.
4. Client searches hotels in Dubai for next month, 2 rooms, 2 adults each.
5. Client opens a hotel, selects a room, prebooks, fills guests, chooses "Pay from Credit", confirms.
6. Booking confirmed, PDF voucher generated, email queued (check Mailcatcher / log).
7. Client dashboard now shows used credit = booking total, outstanding = booking total.
8. Client cancels the booking. Cancellation fee shown. Confirm. Credit refund posted. Outstanding back to 0 (minus fee if any).
9. Admin sees the booking + cancellation in admin bookings view.
10. Admin records a settlement of 1,000 AED via bank transfer → outstanding decreases by 1,000.
11. Client downloads statement PDF → numbers tie out exactly.
12. Admin views Revenue report for this month → shows the booking, the cancellation, the markup earned.
13. Admin creates a sub-admin with "Finance" role → that sub-admin can see credit but gets 403 on CMS.
14. Admin uploads a new banner → appears on client homepage.
15. Trigger a "credit low" condition manually (set credit limit to 5,000, leave outstanding at ~4,500) → daily job fires notification.

Document each step's result with screenshots or log excerpts.

### 10.4 Open the client's PDF requirements doc

`Travel_Agency_B2B_System_Requirements.pdf` is the **original** client document. Cross-check that nothing in the original PDF is missing from `Travel.md` and from the build. If the PDF mentions something the spec or code doesn't address, file a P1 finding.

### 10.5 Done definition

You are done when, and only when:

- `npm run build` and `npx tsc --noEmit` succeed on all three packages with zero errors.
- All test suites pass with coverage targets met.
- Every spec section in `Travel.md` §4, §5, §8, §9, §10, §11, §12, §14 has been ticked off in the spec-to-code matrix.
- Manual E2E walkthrough from §10.3 completes without errors.
- `COMPLETION_REPORT.md` exists with zero open P0 issues and a clear plan for any remaining P1 issues.
- `README.md`, `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/RUNBOOK.md` exist and are real (not placeholders).
- The Docker compose stack boots, the seed runs, and a fresh contributor can go from `git clone` to a logged-in client booking a hotel in < 15 minutes following the README.

---

## 11. Working Style

- **Small commits with clear messages.** `feat(bookings): add compensating refund on supplier failure`. Not "fixes".
- **After each phase, give a one-paragraph status update.**
- **If the spec is ambiguous, don't invent** — flag it under "Spec clarifications needed" in the report and pick the most conservative interpretation in the meantime. The client list in §16 of `Travel.md` is a good starting point.
- **If a change touches > 5 files or > 200 lines, explain the plan first.**
- **If you find anything pointing at production secrets, mainnet endpoints, or live PayTabs/TBO credentials,** stop and flag it before doing anything else.

Go.
