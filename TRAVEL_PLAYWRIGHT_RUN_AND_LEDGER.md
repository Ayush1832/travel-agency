# Travel B2B — Playwright Verification + Ledger Script

Two tasks in one session. Do them in order. Reply only when both are complete.

---

## Task 1 — Actually run the Playwright suite

The four spec files exist (`e2e/client-booking-flow.spec.ts`, `e2e/admin-operational-flow.spec.ts`, `e2e/sub-admin-rbac.spec.ts`, `e2e/cross-tenant-isolation.spec.ts`) but I have no evidence the suite passes. Run it now and report.

```bash
npx playwright test 2>&1 | tail -80
```

Paste the full tail-80 output. I want to see:

- Total tests (X passed, Y failed, Z skipped)
- Duration
- Per-spec result lines
- Any error output, stack traces, or screenshot/video paths for failures

**If everything passes:** confirm and move to Task 2.

**If anything fails:**
1. List each failing test with file:line and the underlying cause (timeout, selector not found, assertion mismatch, mock returned unexpected data, etc.).
2. Classify each failure as one of:
   - **Real app bug** — the application is wrong; the spec correctly caught it.
   - **Mock/setup bug** — the TBO/PayTabs mock or seed data is wrong.
   - **Flaky/timing** — racy await, missing `waitFor`, etc.
3. For real app bugs: fix the app, re-run, document the bug + fix.
4. For mock/setup bugs: fix the mock or seed, re-run.
5. For flaky tests: fix the test (proper `waitFor`, not arbitrary `sleep`), re-run.

Do not move to Task 2 until `npx playwright test` exits with code 0.

Append the final passing run output to `COMPLETION_REPORT.md` under a new section `Playwright E2E Results` with one subsection per spec file (name + tests passed + duration).

---

## Task 2 — Ledger conservation script

Create `scripts/verify-ledger.ts` at the repo root. Connects to the configured Mongo via `MONGO_URI` env var. Runs three assertions. Exits 0 on success, exits 1 with a clear human-readable error report listing every violation.

### Assertion 1 — Per-company wallet ledger balances

For every company in `companies`:

```
debits  = sum(wallet_transactions where companyId == this AND direction == 'debit')
credits = sum(wallet_transactions where companyId == this AND direction == 'credit')
expected = debits - credits
actual = this.outstandingBalance
```

If `expected !== actual`, log: `Company <id> (<name>): ledger says <expected>, outstandingBalance says <actual>, delta <expected-actual>`.

### Assertion 2 — Credit bookings have exactly one matching debit

For every booking where `paymentMethod === 'credit'` AND `status IN ('confirmed', 'completed')`:

```
matches = wallet_transactions where refBookingId == booking._id AND direction == 'debit'
```

If `matches.length !== 1`, log: `Booking <bookingRef>: expected 1 credit-debit ledger entry, found <N>`.
If `matches[0].amount !== booking.totalAmount`, log: `Booking <bookingRef>: ledger entry amount <X> != booking amount <Y>`.

### Assertion 3 — Online bookings have exactly one successful payment

For every booking where `paymentMethod === 'online'` AND `status === 'confirmed'`:

```
matches = payments where bookingId == booking._id AND status == 'success'
```

If `matches.length !== 1`, log: `Booking <bookingRef>: expected 1 successful payment, found <N>`.
If `matches[0].amount !== booking.totalAmount`, log: `Booking <bookingRef>: payment amount <X> != booking amount <Y>`.

### Output format

If all clean:
```
Ledger verification PASSED
- Companies checked: 12
- Credit bookings checked: 47
- Online bookings checked: 23
```

If any failures:
```
Ledger verification FAILED — 3 violation(s)

Assertion 1 — Per-company ledger:
  Company 5f8a... (Acme Travel): ledger says 12500, outstandingBalance says 12000, delta 500

Assertion 2 — Credit booking ledger entries:
  Booking BK-2026-000088: expected 1 credit-debit ledger entry, found 0

Assertion 3 — Online payment matches:
  Booking BK-2026-000123: payment amount 45000 != booking amount 50000

Summary:
- Companies checked: 12 (1 mismatch)
- Credit bookings checked: 47 (1 mismatch)
- Online bookings checked: 23 (1 mismatch)
```

### Wiring

Add to `server/package.json` scripts:

```json
"verify:ledger": "ts-node ../scripts/verify-ledger.ts"
```

Or whatever path placement works with your monorepo layout — the goal is `npm run verify:ledger` works from the `server/` directory.

### Run it against the e2e database

After Task 1 has passed and left data in the e2e database, run:

```bash
MONGO_URI="mongodb://localhost:27017/travel-b2b-e2e" npm run verify:ledger
```

Paste the output. It must be PASSED. If it fails, that means the booking/cancellation/refund flow has a real bug — track down which booking has a mismatched ledger entry, find the code path that should have written it (or shouldn't have), fix, re-run Playwright, re-run the ledger script.

### Document

Append a short subsection to `COMPLETION_REPORT.md` under a new section `Ledger Verification`:

```
## Ledger Verification

The script at `scripts/verify-ledger.ts` asserts financial consistency between
the wallet ledger, company balances, bookings, and payments. Run via
`npm run verify:ledger` (with MONGO_URI pointing at the target database).

Result against e2e database after Playwright suite: PASSED
- Companies checked: N
- Credit bookings checked: N
- Online bookings checked: N
```

---

## Done when

You can reply with:

1. **Playwright run output** — final passing run, total tests, total duration.
2. **Ledger script output** — PASSED with the counts.
3. **`COMPLETION_REPORT.md`** — both sections appended.

If any step in either task fails and you cannot resolve it, stop and report exactly what's broken — don't move on, don't paper over it.

After this, only k6 load testing remains on the original verification list. The project is one short session from shippable.
