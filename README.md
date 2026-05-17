# Travel Agency B2B Platform

A full-stack B2B hotel booking platform for travel agencies in the MENA region. Agency clients log in, search hotels via TBO Technology, make bookings on credit or via PayTabs online payment, and manage their wallet. Admins approve agencies, assign credit limits, and run settlement reports.

## Stack

| Layer | Technology |
|---|---|
| API Server | NestJS 11, TypeScript 5.7 |
| Database | MongoDB 7 (Mongoose 9), replica set for transactions |
| Job Queue | BullMQ + Redis 7 |
| Payment | PayTabs (MENA) |
| Hotel Supplier | TBO Technology API v7 |
| Email | AWS SES |
| SMS | Twilio |
| File Storage | AWS S3 |
| Client App | Angular 21 |
| Admin App | Angular 21 |

## Quick Start (Docker)

```bash
# Clone and start
git clone <repo>
cd travel-agency

# Copy env template
cp infra/.env.example infra/.env
# Edit infra/.env with your TBO, PayTabs, AWS, Twilio credentials

# Boot everything (Mongo replica set + Redis + server)
docker-compose -f infra/docker-compose.yml up --build

# Server is available at http://localhost:3000/api/v1
# Swagger UI at http://localhost:3000/api/docs
```

## Development Setup

```bash
# Server (requires MongoDB replica set + Redis)
cd server
npm install
npm run start:dev

# Client app
cd apps/client
npm install
ng serve --port 4200

# Admin app
cd apps/admin
npm install
ng serve --port 4201
```

## Project Structure

```
travel-agency/
├── server/                   # NestJS API
│   ├── src/
│   │   ├── modules/          # Feature modules
│   │   │   ├── auth/         # JWT auth, refresh tokens, account lockout
│   │   │   ├── bookings/     # Booking lifecycle + PDF voucher
│   │   │   ├── companies/    # Company credit/wallet management
│   │   │   ├── hotels/       # TBO hotel search + Redis cache
│   │   │   ├── payments/     # PayTabs payment sessions + webhooks
│   │   │   ├── wallet/       # Wallet ledger + loyalty points
│   │   │   ├── cms/          # Pages, banners, email templates
│   │   │   ├── support/      # Support ticket system
│   │   │   ├── reports/      # Booking & financial reports
│   │   │   ├── admin/        # Admin operations
│   │   │   └── notifications/# In-app + email + SMS notifications
│   │   ├── jobs/             # BullMQ job processors
│   │   ├── db/schemas/       # Mongoose schemas
│   │   ├── common/           # Guards, interceptors, filters, encryption
│   │   └── config/           # Configuration + secrets validation
│   └── test/                 # E2E tests
├── apps/
│   ├── client/               # Angular 21 client portal
│   └── admin/                # Angular 21 admin panel
└── infra/
    ├── docker-compose.yml    # Full stack with Mongo replica set
    └── .env.example          # Environment template
```

## Key Features

- **Credit system**: agencies book on credit (outstanding balance), settled via admin
- **Wallet system**: prepaid top-up via PayTabs, wallet deducted for bookings
- **Atomic operations**: all credit/booking operations use Mongo transactions
- **Race condition prevention**: `atomicDeductCredit` uses conditional `findOneAndUpdate`
- **Account lockout**: 5 failed logins → 15-minute lockout
- **AES-256-GCM**: sensitive API keys encrypted at rest
- **BullMQ jobs**: async PDF voucher, email, SMS with exponential backoff
- **Redis caching**: hotel search results cached 5 minutes per search hash

## Running Tests

```bash
cd server
npm test                    # All tests
npm run test:cov            # Coverage report
```

## Environment Variables

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full environment variable reference.
