# Operations Runbook

## Common Incidents

### Server won't start

**Symptom**: Process exits immediately after `bootstrap()`  
**Cause**: Boot-time secrets validation failed  
**Fix**: Check logs for `[FATAL] Production secret validation failed`. Set the missing/insecure env vars.

```bash
docker-compose logs server | grep FATAL
```

### Bookings stuck in PENDING

**Symptom**: Bookings created but never confirmed  
**Cause**: TBO API timeout, or Mongo transaction failure  
**Fix**:
1. Check BullMQ dashboard (if installed) or Redis queue depth
2. Check `[CRITICAL]` log lines from `BookingsService`
3. For stuck credit deductions: query companies with high `outstandingBalance` vs expected

```js
// MongoDB: find companies with suspiciously high outstanding
db.companies.find({ outstandingBalance: { $gt: 1000000 } })
```

### Payment webhook not firing

**Symptom**: PayTabs payment succeeded but booking not confirmed  
**Cause**: Webhook URL not reachable from PayTabs servers  
**Fix**:
1. Verify PayTabs dashboard → webhook URL is set correctly
2. Check `payments` collection for `status: 'pending'` records older than 1 hour
3. Manually call `POST /api/v1/payments/verify/:orderId` to re-check status

### High outstanding balance not settling

**Symptom**: Company's `outstandingBalance` not decreasing after settlement  
**Cause**: Settlement job not run, or admin hasn't processed it  
**Fix**: Admin panel → Settlements → Create settlement for the company.

### Redis unavailable

**Symptom**: BullMQ jobs not processing, hotel search cache misses  
**Impact**: 
- Hotel searches will still work (bypasses cache, hits TBO directly — slower)
- BullMQ jobs will queue but not process until Redis recovers  
**Fix**: Restart Redis. Jobs are persisted in Redis; they'll process on recovery.

### MongoDB replica set PRIMARY election

**Symptom**: Write operations failing with "not master" errors  
**Fix**:
```bash
# Connect to mongo container
docker exec -it mongo mongosh
rs.status()  # Check who is PRIMARY
rs.stepDown() # Force election if stuck
```

## Key Log Patterns

| Log Pattern | Meaning | Action |
|---|---|---|
| `[CRITICAL] TBO book() failed after credit deduction` | Credit deducted, TBO failed | Verify `creditBack()` ran. Check supplier status |
| `[CRITICAL] Credit rollback FAILED` | Manual intervention needed | Manually decrement `outstandingBalance` by logged amount |
| `[COMPENSATING] Credit rollback successful` | Automatic recovery worked | No action needed |
| `Cache HIT for searchId=` | Redis cache working | Good |
| `Cache MISS for searchId=` | Cache miss, TBO called | Normal first-time behavior |
| `Redis error (falling back to no-cache)` | Redis unreachable | Check Redis health |

## Manual Credit Adjustment

If a credit rollback failed (logged as `[CRITICAL] Credit rollback FAILED`), manually correct:

```js
// Mongo shell — adjust by the exact amount from the log
db.companies.updateOne(
  { _id: ObjectId("<companyId>") },
  { $inc: { outstandingBalance: -<amount> } }
)

// Record in wallet_transactions for audit
db.wallet_transactions.insertOne({
  companyId: ObjectId("<companyId>"),
  type: "adjustment",
  direction: "credit",
  amount: <amount>,
  description: "Manual rollback: TBO failure on <date>, booking attempt failed",
  performedBy: ObjectId("<adminUserId>"),
  createdAt: new Date()
})
```

## Useful Queries

```js
// Recent failed bookings
db.bookings.find({ status: 'failed' }).sort({ createdAt: -1 }).limit(10)

// Pending refunds
db.bookings.find({ "cancellation.refundStatus": "pending" }).sort({ createdAt: -1 })

// Companies with available credit < 0 (data integrity check)
db.companies.aggregate([
  { $project: {
    name: 1,
    available: { $subtract: [{ $add: ["$creditLimit", "$walletBalance"] }, "$outstandingBalance"] }
  }},
  { $match: { available: { $lt: 0 } } }
])
```
