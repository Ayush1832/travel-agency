# Architecture

## System Overview

```
┌──────────────────┐    ┌──────────────────┐
│  Angular Client  │    │   Angular Admin  │
│  (port 4200)     │    │   (port 4201)    │
└────────┬─────────┘    └────────┬─────────┘
         │                       │
         └──────────┬────────────┘
                    │ HTTPS/JWT
         ┌──────────▼──────────┐
         │    NestJS API       │
         │  (port 3000)        │
         │  /api/v1/*          │
         └──┬───────┬──────────┘
            │       │
    ┌───────▼─┐  ┌──▼──────────┐
    │ MongoDB │  │   Redis     │
    │ (rs0)   │  │ (BullMQ +   │
    └─────────┘  │  Cache)     │
                 └─────────────┘
            │
    External APIs:
    ┌───────▼──────┐  ┌──────────────┐
    │ TBO Hotels   │  │  PayTabs     │
    │ API v7       │  │  (MENA)      │
    └──────────────┘  └──────────────┘
            │
    ┌───────▼──────┐  ┌──────────────┐
    │ AWS SES      │  │  Twilio SMS  │
    └──────────────┘  └──────────────┘
```

## Credit & Wallet Model

The financial model uses three independent fields on each Company document:

| Field | Purpose | Changes on |
|---|---|---|
| `creditLimit` | Admin-assigned booking capacity (minor units) | Admin update only |
| `walletBalance` | Prepaid top-up funds (minor units) | PayTabs webhook (top-up) |
| `outstandingBalance` | Accumulated unpaid credit bookings (minor units) | Each credit booking / settlement |

**Available credit formula**: `MAX(0, creditLimit + walletBalance - outstandingBalance)`

### Credit Booking Flow (Atomic)

```
1. atomicDeductCredit()   ← conditional findOneAndUpdate, prevents race conditions
2. tboService.book()      ← external call, NOT in transaction
   ├── fails → creditBack() (compensating action)
   └── succeeds:
3. session.withTransaction()
   ├── bookingModel.create()
   └── walletTxModel.create()   ← ledger entry
```

### Online Payment Flow

```
1. paymentsService.createOrder() → PayTabs URL returned to client
2. Client pays on PayTabs hosted page
3. PayTabs webhook → handleWebhook()
   ├── verify signature
   ├── idempotency check (already SUCCESS → skip)
   └── topUpWallet() or set booking CONFIRMED
```

## Module Dependency Graph

```
AppModule
├── EncryptionModule (global)
├── AuthModule ← UsersModule, NotificationsModule
├── BookingsModule ← IntegrationsModule, CompaniesModule
├── PaymentsModule ← IntegrationsModule, CompaniesModule
├── WalletModule ← CompaniesModule, PaymentsModule
├── HotelsModule ← IntegrationsModule
├── AdminModule
├── CmsModule
├── SupportModule
├── ReportsModule
└── JobsModule (BullMQ processors)
```

## Job Queue Architecture

BullMQ queues (backed by Redis) handle all async work:

| Queue | Jobs | Triggers |
|---|---|---|
| `QUEUE_VOUCHER` | `JOB_GENERATE_VOUCHER` | Booking confirmed |
| `QUEUE_EMAIL` | `JOB_SEND_EMAIL` | Any notification |
| `QUEUE_SMS` | `JOB_SEND_SMS` | Any notification |
| `QUEUE_REPORT` | `JOB_EXPORT_REPORT` | Report requested |
| `QUEUE_SETTLEMENT_REMINDER` | `JOB_SEND_SETTLEMENT_REMINDER` | Scheduled |

All queues: 5 retry attempts, exponential backoff starting at 5 seconds.

## Security Layers

1. **Helmet** — HTTP security headers
2. **ThrottlerGuard** — 10/s short, 50/10s medium, 200/min long rate limits  
3. **JWT** — 15-minute access tokens, 7-day refresh tokens (hashed in DB)
4. **Account lockout** — 5 failed logins → 15-minute lockout
5. **AES-256-GCM** — API config keys encrypted at rest
6. **Mongo transactions** — atomic credit + booking writes
7. **sanitize-html** — CMS page bodies sanitized before storage
8. **CORS** — restricted to configured app origins
9. **Production secrets guard** — boot-time check rejects unsafe defaults

## Database Indexes

Critical indexes for query performance:

- `bookings`: `{ companyId, createdAt }`, `{ bookingRef }` unique, `{ companyId, status }`, `{ supplierBookingRef }` sparse
- `payments`: `{ gatewayOrderId }` unique sparse, `{ companyId, createdAt }`, `{ status }`
- `wallet_transactions`: `{ companyId, createdAt }`, `{ refBookingId }` sparse
- `users`: `{ email }` unique, `{ companyId }`, `{ role }`
- `companies`: `{ email }` unique, `{ status }`
