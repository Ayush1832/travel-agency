# Travel B2B — Final Verification Pass

The notification provider wiring, RBAC matrix, cross-tenant isolation, voucher PDF tests, OpenAPI export, and zero npm audit vulns are accepted. Before declaring this project shippable, I need either evidence or completion of the items below from `TRAVEL_FOLLOWUP_PROMPT.md` that were not addressed in the last update.

**Reply in a single message.** For each numbered item, give one of: (a) test file path + test names, (b) implementation file:line, (c) command output paste, or (d) "Not done — here's why."

## Part A — Evidence (do not redo)

1. **Per-module coverage table.** Run and paste full output:
   ```
   cd server && npm test -- --coverage 2>&1 | tail -100
   ```
   I need to see actual numbers per file. The follow-up required: ≥70% lines on `server/src/modules/` overall, **100% lines + 100% branches** on `bookings/`, `payments/`, `wallet/`, ≥80% lines on `server/src/integrations/`. If any threshold is not met, list the uncovered file:line ranges.

2. **Cancellation + refund tests** (follow-up item #6). Confirm tests exist for: credit cancellation with atomic refund + ledger entry, online cancellation with PayTabs refund webhook flow, non-refundable rate, past check-in date, wrong-tenant cancel → 404. Paste the spec file path and test names.

3. **PayTabs webhook replay test** (follow-up item #7). Paste the test from `paytabs.service.spec.ts` that fires the same webhook twice and asserts no double-credit, no duplicate booking, no duplicate notification.

4. **Manual 15-step walkthrough — actually executed?** The report mentions "manual walkthrough" but I need to see the step-by-step results. Paste each of the 15 steps from §10.3 of the original brief with the actual outcome (PASS/FAIL), log excerpts or screenshots for at least steps 3, 5, 6, 8, 10, 12, 13, 15. If you only wrote the section template without executing it, say so.

5. **RBAC guard application audit.** Run:
   ```
   cd server && grep -rn "@RequirePermission" src/modules/ | wc -l
   cd server && grep -rln "Controller" src/modules/admin/ src/modules/companies/ src/modules/cms/ | xargs -I {} grep -L "@RequirePermission" {}
   ```
   First number should be ≥ the count of admin endpoints. Second command lists any admin controller files **without** a `@RequirePermission` decorator — that list should be empty.

## Part B — Genuinely missing work (do this)

6. **Angular tests — both apps.** Currently zero spec files exist in either `apps/client/src/` or `apps/admin/src/`. The brief required ≥60% line coverage on each. Add at minimum the test set from follow-up item #8:
   - Auth service tests (login, refresh, logout, token storage)
   - HTTP interceptor tests (Bearer attach, 401 refresh, logout on refresh failure)
   - Route guard tests (auth guard, role guard, company-approval guard)
   - One feature component test per app: hotel search component (client), client list component (admin)

   Run `ng test --watch=false --code-coverage` for each and paste both coverage summaries. If you cannot reach 60%, paste what you got and list the gap.

7. **Playwright E2E tests.** Set up Playwright at the monorepo root if missing. Write the four E2E specs from follow-up item #9:
   - Client flow: register → admin approves → login → search → prebook → pay from credit → see booking → download voucher → cancel → see refund
   - Admin flow: login as super_admin → approve client → assign credit → record settlement → revenue report
   - Sub-admin RBAC: Finance role can see credit, cannot see CMS (403 or redirect)
   - Cross-tenant: Company 1 user navigating to a Company 2 booking URL → 404

   Run `npx playwright test` and paste the result line.

8. **Load test.** Run k6 or Artillery against the docker compose stack (TBO mocked at 500ms):
   - Hotel search: 100 concurrent users for 5 min
   - Booking: 10 concurrent users in parallel
   
   Paste the summary (p50/p95/p99 latency, error rate, throughput) into `COMPLETION_REPORT.md` under "Performance Test Results" and quote it back to me.

9. **Ledger conservation script.** Write a one-off script (`scripts/verify-ledger.ts`) that connects to the test DB after the load test and asserts:
   - For every company: `sum(wallet_transactions where direction='debit') - sum(direction='credit') == outstandingBalance`
   - For every booking with `paymentMethod='credit'`: there is exactly one matching `wallet_transactions` entry with `refBookingId = booking._id` and matching amount.
   - Total `payments.amount` where `status='success'` matches the sum of online booking totals + topups.
   
   Run it after the load test from item #8 and paste the result.

## Part C — Doc + report state

10. **`COMPLETION_REPORT.md` Done Definition Checklist.** Paste the section. Every one of the 11 bullets from the bottom of `TRAVEL_FOLLOWUP_PROMPT.md` must be present and ticked with evidence (file path, test count, coverage number, or "deferred because X"). If any bullet is not ticked or evidence is hand-wavy, fix it.

11. **`docs/openapi.json` + `docs/api.html`.** Confirm both exist. Run:
    ```
    ls -la docs/openapi.json docs/api.html
    node -e "const s=require('./docs/openapi.json'); console.log('paths:',Object.keys(s.paths).length,'tags:',(s.tags||[]).length)"
    ```
    Paste output.

## Done when

You can paste all 11 items in one reply with concrete evidence. Items 1, 5, 11 are command output. Items 2, 3 are test citations. Items 4, 10 are direct quotes from the report. Items 6, 7, 8, 9 are real work + their output.

If any item is "Not done," say so — don't dress it up. I'd rather know exactly what's left.
