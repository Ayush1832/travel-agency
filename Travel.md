# Travel Agency B2B Platform — Full Build Specification

> Source: Client PDF "Travel Agency B2B Platform System Requirements"
> Purpose: Hand this document to Claude Code (or any dev team) as the master build spec.
> Tech Stack: **MEAN (MongoDB + Express + Angular + Node.js)** on **AWS**.

---

## 1. Executive Summary (What This Project Is)

This is a **B2B (Business-to-Business) hotel booking platform**. It is NOT a B2C site like Booking.com or Expedia. The customers are **other businesses** — corporate travel agencies, sub-agents, tour operators, and corporate clients — who book hotels on behalf of their own end customers.

**Core idea:** The travel agency (you / the client running the platform) wraps third-party hotel inventory APIs (e.g., Hotelbeds, TBO, RateHawk, Travelfusion, etc.) and resells them to business clients. Business clients can pay in two ways:

1. **Online payment** (card / gateway) — paid per booking.
2. **Credit / Wallet** — the admin pre-assigns each business client a credit limit; bookings deduct from credit; the client settles outstanding amounts later (post-paid invoicing).

The **admin** (platform owner) manages clients, credit limits, settlements, hotel API configurations, payment gateways, content (CMS), sub-admins with role-based access, and sees revenue / outstanding reports.

**Two user-facing applications:**
- **Client Website** — where business clients log in, search hotels, book, pay, manage bookings, see credit balance.
- **Admin Panel** — where the platform owner and sub-admins operate the business.

Both are responsive web apps backed by the same Node.js API and MongoDB database.

---

## 2. User Roles & Permissions

### 2.1 Super Admin (Platform Owner)
Full access to everything: client management, credit management, API keys, payment gateway settings, CMS, sub-admin creation, reports.

### 2.2 Sub-Admin (Staff)
Granular permissions assigned by Super Admin. Examples:
- Finance sub-admin: credit & settlement only
- Operations sub-admin: bookings & cancellations only
- Content sub-admin: CMS only
- Support sub-admin: tickets only

Permissions are module-level (view/create/edit/delete per module).

### 2.3 Business Client (B2B Account)
A company account. Has:
- Company profile (name, address, GSTIN/Tax ID, contact)
- Credit limit assigned by admin
- Wallet balance (top-ups)
- One or more users under it (optional — see §2.4)

### 2.4 Business Client Sub-User (Optional but Recommended)
A user belonging to a business client company. E.g., 5 agents at one travel agency share one company account. Permissions: book, view own bookings, view company credit (read-only).

> **Recommendation for Claude Code:** Build a `users` collection with `role` and `companyId` so this two-tier (company + users under it) structure is supported out of the box, even if MVP launches with one user per company.

---

## 3. Main System Components (High-Level Modules)

| # | Module | Lives In |
|---|--------|----------|
| 1 | Client Website | Angular app `apps/client` |
| 2 | Admin Panel | Angular app `apps/admin` |
| 3 | Booking Management System | Node.js service `services/booking` |
| 4 | Credit & Wallet System | Node.js service `services/wallet` |
| 5 | Payment System | Node.js service `services/payment` |
| 6 | Notification System | Node.js service `services/notification` |
| 7 | CMS Management | Node.js service `services/cms` |
| 8 | Reports & Analytics | Node.js service `services/reports` |
| 9 | API Integrations Layer | Node.js service `services/integrations` |

Recommend a **modular monolith** (single Node.js app, clean folder boundaries) rather than microservices for MVP — easier to deploy and debug. Can split later.

---

## 4. Client Website — Detailed Feature Breakdown

### 4.1 Authentication & Account Management
- **Registration**: Company name, contact person, email, phone, business address, tax ID, password. New registrations land in `pending` state; admin must approve before login is allowed.
- **Login/Logout**: Email + password → JWT access token (15 min) + refresh token (7 days). HTTP-only cookies recommended.
- **Password reset**: Email-based token flow, token TTL 30 min.
- **Session management**: List active sessions, force logout from all devices.
- **Email verification** (recommended add-on): verify email at registration.
- **2FA** (recommended add-on): TOTP for high-value B2B accounts.

### 4.2 Dashboard
Landing page after login. Cards:
- Current credit balance (used / available / limit)
- Booking statistics (total bookings, this month, upcoming, cancelled)
- Recent activity (last 5–10 bookings / payments)
- Quick actions (Search Hotel, Top-up Wallet, View Bookings)
- Outstanding balance warning if any payment overdue

### 4.3 Hotel Search
**Search form fields:**
- Destination (city/hotel name) — autocomplete from Hotel API or own location DB
- Check-in date, Check-out date (date pickers, min = today)
- Number of rooms
- Per-room: number of adults, number of children, children ages
- Nationality of guest (some APIs require this)
- Currency (optional)

**On submit:** Backend calls the configured Hotel API(s) in real time, normalizes responses, returns to frontend. Results cached briefly (e.g., 5 min per search hash) to reduce API costs.

### 4.4 Filters & Sorting (on Search Results page)
- Price range slider
- Star rating (1–5)
- Amenities checkboxes (WiFi, Pool, Parking, Breakfast included, etc.)
- Room types (Single, Double, Suite, etc.)
- Meal plan (Room Only, Breakfast, Half Board, All Inclusive)
- Cancellation policy (Free cancellation only)
- Sort: Price (low→high, high→low), Star rating, Popularity, Recommended

### 4.5 Hotel Details Page
- Hotel name, address, star rating
- Photo gallery (carousel)
- Description (rich text from API)
- Amenities list
- Room types and pricing matrix (per room type × meal plan × refundable/non-refundable)
- Cancellation policy per rate
- Hotel policies (check-in time, check-out time, child policy, pet policy)
- Google Maps embed showing hotel location
- Nearby attractions (if API provides)
- Reviews (if API provides)
- "Select Room" button → goes to Checkout

### 4.6 Booking & Checkout
- Booking summary (hotel, dates, room, nights, taxes, total)
- Guest details form (lead guest + per-room guest names; some APIs require passport/ID)
- Special requests text field
- Payment method selector: **Pay Online** or **Pay from Credit**
  - If credit chosen and credit < total → block & show top-up CTA
- Acceptance of cancellation policy checkbox
- **Confirm & Pay** button:
  - If "Pay Online" → redirect to payment gateway → on success, confirm booking with Hotel API → save booking → generate PDF voucher
  - If "Pay from Credit" → deduct credit → confirm booking with Hotel API → save booking → generate PDF voucher
- **PDF voucher** auto-emailed + downloadable, contains: booking ref, hotel, guest, dates, room, total, agency contact, cancellation policy, hotel confirmation number.

### 4.7 Booking Management (My Bookings)
- List view with columns: Booking Ref, Hotel, Check-in, Check-out, Guest, Status, Amount, Actions
- Filters: Date range, status (Confirmed/Cancelled/Pending/Completed), payment method
- Search by booking ref or guest name
- Actions: View Details, Download Voucher (PDF), Cancel Booking
- **Cancel booking flow:** Show cancellation cost from Hotel API → confirm → call cancel API → refund (credit refund or gateway refund per original payment method) → email update

### 4.8 Wallet & Credit System (Client View)
- Current credit limit, used credit, available credit
- Outstanding balance (unsettled bookings)
- Credit usage history (table: date, booking ref, debit, credit, balance after)
- Top-up wallet (online payment → adds to wallet balance, separate from credit limit)
- Statement download (PDF or Excel) per date range

### 4.9 Notifications (Client)
In-app bell icon + email + (optional) SMS:
- Booking confirmed / cancelled / modified
- Payment received / failed
- Credit low (e.g., < 20% remaining)
- Outstanding payment reminder
- Hotel API booking update (rare: hotel-side modifications)

### 4.10 Support
- Submit support ticket (subject, category, message, optional booking ref attachment)
- View ticket history & status
- Reply to admin's responses

---

## 5. Admin Panel — Detailed Feature Breakdown

### 5.1 Admin Dashboard
KPI cards + charts:
- Total clients (active / pending / disabled)
- Total bookings (today / month / year)
- Revenue (gross sales, commission/markup earned)
- Outstanding balances (total owed by clients)
- Top clients by revenue
- Booking trend graph (line chart, last 30 days)
- Cancellation rate

### 5.2 Client Management
- List all business client accounts (search, filter by status, sort)
- View details: company info, users, bookings, credit, transactions
- Approve / reject pending registrations
- Activate / deactivate / suspend account
- Edit company profile (admin override)
- Reset client password / force password change
- View client's audit log

### 5.3 Credit Management
- Assign / update credit limit per client
- View current credit usage per client
- **Top-up balance** (manual: admin adds money to client wallet, e.g., after receiving a bank transfer)
- **Settlement tracking:**
  - Record settlements (date, amount, mode, reference, attachment)
  - Reduce outstanding when settled
  - Generate settlement statements
- **Outstanding management:** list all clients with outstanding > 0, aging buckets (0–30 / 31–60 / 61–90 / 90+ days), send reminders (manual or automated)

### 5.4 Booking Management (Admin)
- View ALL bookings across all clients
- Advanced filter: client, hotel, date range, status, payment method
- Update booking status (manual override: confirm/cancel/no-show)
- Resend voucher
- Issue refunds
- Hotel API resync (re-fetch booking status from supplier)
- Export bookings (CSV / Excel)

### 5.5 Reports & Analytics
- **Revenue report**: gross sales, commission/markup, net revenue per period
- **Booking report**: count by status, by hotel, by destination, by client
- **Credit report**: outstanding by client, settlements received, top-ups
- **Cancellation report**: count, value, top reasons (if collected)
- **API report**: hotel API hit counts, success rate, error rate, latency
- All reports filterable by date range; exportable to CSV / Excel / PDF.

### 5.6 CMS Management
- **Static pages**: About Us, Contact, Terms, Privacy, FAQ (rich text editor — TinyMCE/Quill)
- **Homepage banners**: image, link, title, sort order, active/inactive, schedule
- **Promotional content**: deals/offers blocks
- **Email templates**: editable templates for confirmations, reminders, password reset (with variable placeholders like `{{guestName}}`)

### 5.7 Sub-Admin Management
- **Roles**: define named roles (e.g., "Finance", "Operations") with module-level permissions
- **Permissions matrix**: per module (Bookings, Credit, Clients, CMS, Reports, API Settings, Sub-Admin, Support) — actions: view / create / edit / delete
- **Sub-admin accounts**: name, email, role, status; CRUD operations
- **Activity log** per sub-admin

### 5.8 Support System (Admin)
- View all tickets, filter by status / priority / category / assignee
- Assign to sub-admin
- Reply (threaded), close, reopen
- SLA tracking (optional)

### 5.9 API Management
- **Hotel API settings**: endpoint URL, API key, secret, currency, markup % (per supplier), enable/disable
- Support multiple hotel suppliers concurrently with priority/fallback
- **Payment gateway settings**: keys, webhook secrets, currency, sandbox/live toggle
- **Google Maps**: API key, default map region
- **Email service**: SMTP / SendGrid / SES config
- **SMS service**: Twilio / MSG91 / etc.
- All keys stored encrypted (AES-256) at rest; surfaced masked in UI.

---

## 6. Technology Stack (Final Recommended Versions)

| Layer | Tech | Recommended Version |
|---|---|---|
| Frontend | Angular | 17 or 18 (latest LTS) |
| Frontend UI Lib | Angular Material + Tailwind CSS (or PrimeNG) | latest |
| Frontend State | NgRx or Akita | latest |
| Backend | Node.js + Express (or NestJS for stronger structure) | Node 20 LTS |
| Language | TypeScript end-to-end | 5.x |
| Database | MongoDB | 7.x (Atlas preferred) |
| ODM | Mongoose | latest |
| Auth | JWT + bcrypt | — |
| Cache / Queue | Redis | 7.x |
| Job Queue | BullMQ (Redis-backed) | latest |
| File Storage | AWS S3 | — |
| Email | AWS SES or SendGrid | — |
| SMS | Twilio or MSG91 | — |
| Hosting | AWS (EC2 / ECS-Fargate / Beanstalk) | — |
| CDN | AWS CloudFront | — |
| Logs | AWS CloudWatch + structured JSON logs | — |
| Monitoring | Datadog / NewRelic / Sentry | — |
| CI/CD | GitHub Actions → AWS | — |
| Containerization | Docker + docker-compose | — |

> **Strong recommendation:** Use **NestJS** instead of plain Express. NestJS gives you decorators, DI, modules, guards, pipes, and validation out of the box — perfect for a structured B2B platform with many modules. Plain Express works too but you'll re-invent these patterns.

---

## 7. Architecture Overview

### 7.1 High-Level Diagram (textual)
```
┌─────────────────────┐        ┌─────────────────────┐
│  Angular Client     │        │  Angular Admin      │
│  (apps/client)      │        │  (apps/admin)       │
└──────────┬──────────┘        └──────────┬──────────┘
           │ HTTPS / REST                  │
           └────────────┬──────────────────┘
                        ▼
                ┌──────────────────┐
                │  NGINX / ALB     │  ← AWS Application Load Balancer
                └────────┬─────────┘
                         ▼
                ┌──────────────────────────────────────┐
                │  Node.js API (NestJS / Express)      │
                │  ─ Auth Module                       │
                │  ─ Hotel Search / Booking Module     │
                │  ─ Credit / Wallet Module            │
                │  ─ Payment Module                    │
                │  ─ Notification Module               │
                │  ─ CMS Module                        │
                │  ─ Reports Module                    │
                │  ─ Integrations Module               │
                └────────┬─────────────────────────────┘
                         │
        ┌────────────────┼──────────────────────────┐
        ▼                ▼                          ▼
┌──────────────┐  ┌─────────────┐         ┌──────────────────┐
│  MongoDB     │  │  Redis      │         │ External APIs    │
│  (Atlas)     │  │ (cache/jobs)│         │  Hotelbeds/TBO/  │
└──────────────┘  └─────────────┘         │  Stripe/SES/...  │
                                          └──────────────────┘
```

### 7.2 Suggested Folder Structure (Monorepo)
```
travel-b2b/
├── apps/
│   ├── client/                 # Angular client website
│   └── admin/                  # Angular admin panel
├── packages/
│   └── shared-types/           # Shared TS interfaces (Booking, User, etc.)
├── server/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── companies/
│   │   │   ├── hotels/         # search, details
│   │   │   ├── bookings/
│   │   │   ├── wallet/         # credit, top-ups, settlements
│   │   │   ├── payments/
│   │   │   ├── notifications/
│   │   │   ├── cms/
│   │   │   ├── reports/
│   │   │   ├── support/
│   │   │   ├── admin/          # sub-admin & roles
│   │   │   └── integrations/   # hotel APIs, payment gw, maps
│   │   ├── common/
│   │   │   ├── guards/
│   │   │   ├── interceptors/
│   │   │   ├── middlewares/
│   │   │   ├── decorators/
│   │   │   └── utils/
│   │   ├── config/
│   │   ├── jobs/               # BullMQ workers
│   │   ├── db/                 # Mongoose schemas
│   │   └── main.ts
│   ├── tests/
│   ├── Dockerfile
│   └── package.json
├── infra/
│   ├── terraform/              # AWS infra-as-code
│   └── docker-compose.yml
├── docs/
│   ├── API.md
│   ├── ARCHITECTURE.md
│   └── DEPLOYMENT.md
└── README.md
```

---

## 8. Database Schema (MongoDB / Mongoose)

> All collections have `_id`, `createdAt`, `updatedAt`. Soft delete via `deletedAt` field where relevant. All money fields stored in **minor units (paise/cents)** as `Number` to avoid float issues.

### 8.1 `companies` (Business Client Accounts)
```js
{
  _id, name, contactPerson, email (unique), phone,
  address: { line1, line2, city, state, country, postalCode },
  taxId, businessRegistrationNo,
  status: 'pending' | 'active' | 'suspended' | 'rejected',
  creditLimit: Number,              // assigned by admin
  walletBalance: Number,            // top-ups
  outstandingBalance: Number,       // unsettled
  currency: 'INR' | 'USD' | ...,
  approvedAt, approvedBy (adminId),
  notes,
  createdAt, updatedAt, deletedAt
}
```

### 8.2 `users`
```js
{
  _id, companyId (ref companies, null for admins),
  role: 'client_owner' | 'client_user' | 'super_admin' | 'sub_admin',
  subRoleId: ObjectId (ref roles, for sub_admin only),
  firstName, lastName, email (unique), phone,
  passwordHash, passwordSalt,
  emailVerified: Boolean, twoFactorEnabled: Boolean,
  status: 'active' | 'disabled',
  lastLoginAt, lastLoginIp,
  createdAt, updatedAt
}
```

### 8.3 `roles` (Sub-Admin Roles)
```js
{
  _id, name, description,
  permissions: [
    { module: 'bookings', actions: ['view','create','edit','delete'] },
    { module: 'credit',   actions: ['view','edit'] },
    ...
  ],
  isSystem: Boolean,  // built-in role can't be deleted
  createdAt, updatedAt
}
```

### 8.4 `bookings`
```js
{
  _id, bookingRef (unique, e.g. "BK-2026-000123"),
  companyId, bookedByUserId,
  supplier: 'hotelbeds' | 'tbo' | ...,
  supplierBookingRef,
  hotel: {
    supplierHotelId, name, address, city, country,
    starRating, lat, lng, phone, imageUrl
  },
  rooms: [{
    roomType, mealPlan, refundable: Boolean,
    cancellationPolicy: [{ from, to, amount }],
    adults, children, childrenAges: [Number],
    leadGuest: { firstName, lastName, title },
    guests: [{ firstName, lastName, title, dob? }]
  }],
  checkIn: Date, checkOut: Date, nights: Number,
  currency, baseAmount, taxAmount, totalAmount,
  markupAmount,                     // platform markup
  paymentMethod: 'online' | 'credit',
  paymentId (ref payments),
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'failed',
  voucherUrl,                       // S3 link to PDF
  specialRequests,
  cancellation: {
    cancelledAt, cancelledBy (userId),
    cancellationFee, refundAmount, refundStatus
  },
  apiRaw: { searchPayload, bookPayload, bookResponse, ... }, // for debugging
  createdAt, updatedAt
}
```

### 8.5 `payments`
```js
{
  _id, companyId, userId,
  type: 'booking_online' | 'wallet_topup' | 'refund',
  bookingId (nullable),
  gateway: 'stripe' | 'razorpay' | 'paytabs' | ...,
  gatewayOrderId, gatewayPaymentId, gatewaySignature,
  amount, currency, status: 'created' | 'pending' | 'success' | 'failed' | 'refunded',
  paidAt, raw, webhookEvents: [],
  createdAt, updatedAt
}
```

### 8.6 `wallet_transactions` (ledger)
```js
{
  _id, companyId,
  type: 'topup' | 'credit_use' | 'credit_refund' | 'settlement' | 'adjustment',
  direction: 'credit' | 'debit',
  amount, balanceAfter,
  refBookingId, refPaymentId, refSettlementId,
  description,
  performedBy (userId or adminId),
  createdAt
}
```

### 8.7 `settlements`
```js
{
  _id, companyId, amount, mode: 'bank_transfer'|'cheque'|'cash'|'gateway',
  referenceNo, attachmentUrl, notes,
  recordedBy (adminId), recordedAt,
  appliedTo: [{ bookingId, amountApplied }]    // optional: link to specific bookings
}
```

### 8.8 `notifications`
```js
{
  _id, recipientUserId, recipientCompanyId,
  channel: 'inapp' | 'email' | 'sms',
  type: 'booking_confirmed' | 'payment_received' | 'credit_low' | ...,
  title, message, data: {...},
  readAt, sentAt, status, createdAt
}
```

### 8.9 `cms_pages`, `cms_banners`, `cms_email_templates`
Standard CMS shapes — slug, title, body (HTML), seo metadata, isPublished, image, sortOrder, schedule.

### 8.10 `support_tickets`
```js
{
  _id, ticketNo, companyId, userId,
  subject, category, priority, status: 'open'|'in_progress'|'resolved'|'closed',
  bookingRef (optional),
  assignedTo (subAdminId),
  messages: [{ from, fromType, body, attachments, createdAt }],
  createdAt, updatedAt, closedAt
}
```

### 8.11 `api_configs`
Encrypted per supplier (hotel APIs, payment gateways, SMS, email).

### 8.12 `audit_logs`
Every admin action and security-sensitive client action.
```js
{ _id, actorId, actorType, action, module, targetId, before, after, ip, userAgent, createdAt }
```

### 8.13 Recommended Indexes
- `bookings`: `{companyId:1, createdAt:-1}`, `{bookingRef:1}` unique, `{status:1}`, `{checkIn:1}`
- `payments`: `{gatewayOrderId:1}`, `{companyId:1, createdAt:-1}`
- `wallet_transactions`: `{companyId:1, createdAt:-1}`
- `users`: `{email:1}` unique
- `companies`: `{email:1}` unique, `{status:1}`

---

## 9. REST API Surface (Endpoints)

Base: `/api/v1`. All admin routes prefixed `/admin`. JSON in / JSON out. JWT in `Authorization: Bearer ...` or HTTP-only cookie.

### 9.1 Auth
```
POST   /auth/register                  (client signup → pending)
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh
POST   /auth/forgot-password
POST   /auth/reset-password
POST   /auth/verify-email
GET    /auth/me
POST   /auth/sessions/revoke-all
```

### 9.2 Hotels (Client)
```
GET    /hotels/destinations/autocomplete?q=
POST   /hotels/search                  (body: destination, dates, rooms, pax)
GET    /hotels/:supplierHotelId?searchId=...     (details)
POST   /hotels/prebook                 (lock price/availability)
```

### 9.3 Bookings (Client)
```
POST   /bookings                       (create — body includes prebook token, guests, paymentMethod)
GET    /bookings                       (list — filters & pagination)
GET    /bookings/:id
GET    /bookings/:id/voucher           (PDF stream)
POST   /bookings/:id/cancel
```

### 9.4 Payments
```
POST   /payments/create-order          (for online payment / topup)
POST   /payments/verify                (after gateway return)
POST   /payments/webhook/:gateway      (gateway → us)
GET    /payments                       (history for client)
```

### 9.5 Wallet & Credit (Client)
```
GET    /wallet/balance
GET    /wallet/transactions
POST   /wallet/topup                   (initiates online payment for topup)
GET    /wallet/statement?from=&to=     (PDF/Excel)
```

### 9.6 Notifications
```
GET    /notifications
PATCH  /notifications/:id/read
POST   /notifications/read-all
```

### 9.7 Support
```
POST   /support/tickets
GET    /support/tickets
GET    /support/tickets/:id
POST   /support/tickets/:id/reply
```

### 9.8 Admin — Clients
```
GET    /admin/clients
GET    /admin/clients/:id
POST   /admin/clients/:id/approve
POST   /admin/clients/:id/reject
POST   /admin/clients/:id/activate
POST   /admin/clients/:id/suspend
PATCH  /admin/clients/:id
```

### 9.9 Admin — Credit
```
PATCH  /admin/clients/:id/credit-limit
POST   /admin/clients/:id/topup
POST   /admin/clients/:id/settlement
GET    /admin/clients/:id/transactions
GET    /admin/outstanding                  (all clients with >0 outstanding)
POST   /admin/outstanding/:companyId/remind
```

### 9.10 Admin — Bookings
```
GET    /admin/bookings
GET    /admin/bookings/:id
PATCH  /admin/bookings/:id/status
POST   /admin/bookings/:id/resync
POST   /admin/bookings/:id/refund
GET    /admin/bookings/export?format=csv
```

### 9.11 Admin — Reports
```
GET    /admin/reports/revenue?from=&to=
GET    /admin/reports/bookings?from=&to=&groupBy=
GET    /admin/reports/credit?from=&to=
GET    /admin/reports/api-usage?from=&to=
GET    /admin/reports/:type/export?format=
```

### 9.12 Admin — CMS
```
CRUD   /admin/cms/pages
CRUD   /admin/cms/banners
CRUD   /admin/cms/email-templates
```

### 9.13 Admin — Sub-Admins & Roles
```
CRUD   /admin/roles
CRUD   /admin/sub-admins
```

### 9.14 Admin — API Configs
```
GET    /admin/integrations
PATCH  /admin/integrations/:provider
POST   /admin/integrations/:provider/test
```

### 9.15 Admin — Support
```
GET    /admin/support/tickets
PATCH  /admin/support/tickets/:id        (assign, status)
POST   /admin/support/tickets/:id/reply
```

---

## 10. Critical Workflows (Step-by-Step)

### 10.1 Hotel Search → Book → Pay (Online)
1. Client submits search form → `POST /hotels/search`.
2. Backend fans out to all enabled hotel suppliers in parallel, normalizes results, merges & dedupes, caches by hash for 5 min, returns.
3. Client clicks hotel → `GET /hotels/:id` → details fetched from that supplier.
4. Client selects room → `POST /hotels/prebook` → supplier locks rate, returns prebook token + final price.
5. Client fills guest info, chooses Pay Online → `POST /payments/create-order` returns gateway order id.
6. Frontend opens gateway widget (Stripe/Razorpay).
7. On success, frontend calls `POST /bookings` with prebook token + payment id.
8. Backend: verifies payment with gateway → calls supplier's BOOK API → on success: persists booking, generates PDF voucher (PDFKit/Puppeteer), uploads to S3, emails it, returns booking.
9. **Compensating action**: if supplier BOOK fails AFTER payment captured → auto-refund and create error ticket. CRITICAL.

### 10.2 Hotel Search → Book → Pay (Credit)
Same as above but step 5–7 replaced by: check `availableCredit >= total` → atomically deduct → call BOOK → on success record `wallet_transactions` debit. On failure, rollback debit.

### 10.3 Cancellation
1. Client clicks Cancel → `POST /bookings/:id/cancel`.
2. Backend fetches cancellation policy → shows fee.
3. On confirm: call supplier CANCEL API → on success update booking status → process refund:
   - Online paid → gateway refund (async, set status to `refund_pending`, watch webhook)
   - Credit paid → immediate credit-back transaction
4. Send notifications + email.

### 10.4 Credit Limit & Settlement
- Admin sets `creditLimit`. `availableCredit = creditLimit - outstandingBalance + walletBalance`.
- Each credit booking: increases `outstandingBalance`.
- Settlement reduces `outstandingBalance` and creates `settlements` doc + `wallet_transactions` ledger entry.
- Aging report queries bookings by `createdAt` against today.

### 10.5 Sub-Admin Permission Check
On every admin request, middleware loads sub-admin's role → checks `module + action` matches → 403 if not allowed.

---

## 11. Third-Party Integrations (Detail)

### 11.1 Hotel Booking APIs
Pluggable adapter interface. Each supplier implements:
```ts
interface HotelSupplier {
  search(criteria): Promise<NormalizedHotelResult[]>;
  details(hotelId, searchToken): Promise<NormalizedHotelDetails>;
  prebook(roomToken): Promise<PrebookResult>;
  book(prebookToken, guests): Promise<BookingResult>;
  cancel(supplierBookingRef): Promise<CancelResult>;
  getCancellationPolicy(token): Promise<CancellationPolicy>;
}
```
Common suppliers: **Hotelbeds, TBO Holidays, RateHawk, Travelfusion, Expedia EPS, Agoda Affiliate, GIATA, Travco**. Client must confirm which one(s) they have credentials for.

### 11.2 Payment Gateways
Recommended: **Razorpay** (India), **Stripe** (global), **PayTabs** (MENA), **PayPal**. Same adapter pattern. Webhook handling is mandatory. Always verify signatures.

### 11.3 Google Maps
- Maps JavaScript API on details page
- Places Autocomplete API for destination search
- Geocoding to back-fill lat/lng if supplier doesn't provide

### 11.4 Email & SMS
- **Email**: AWS SES (cheap, reliable) or SendGrid. Templated via MJML or Handlebars + stored in `cms_email_templates`.
- **SMS**: Twilio (global) or MSG91 (India). Used for OTP, booking confirmations.

---

## 12. Security Requirements (Implementation)

| Requirement | Implementation |
|---|---|
| SSL encryption | AWS ACM cert on CloudFront/ALB. Force HTTPS, HSTS. |
| Secure APIs | JWT with short TTL, refresh rotation. CORS allowlist. Helmet.js. Rate limiting per IP+user. |
| Session protection | HTTP-only + Secure + SameSite=Strict cookies. CSRF token for state-changing requests. |
| DDOS protection | AWS Shield Standard (free) + WAF rules + rate limiting at API gateway + per-IP throttling. |
| User permission management | RBAC via `roles` collection; middleware-enforced on every admin route. |
| Backend security hardening | bcrypt cost 12+ for passwords. AES-256 encryption for API keys at rest. Input validation via class-validator/Joi. Mongo injection protection (Mongoose handles). Parameterized queries only. No string-concatenated regex on user input. Dependency scanning via `npm audit` + Snyk. Secrets in AWS Secrets Manager — never in code. |

Additional musts:
- OWASP Top 10 review before launch.
- Audit logging on every privileged action.
- PII-friendly logging (no passwords, no card data, no full tokens).
- PCI-DSS scope minimization: NEVER touch raw card numbers — always tokenized by gateway.
- Backup: MongoDB Atlas continuous backup or daily snapshots; tested restore.

---

## 13. Performance & Quality

### 13.1 Testing
- **Unit tests**: Jest, target 70%+ coverage on services.
- **Integration tests**: Supertest hitting Express/Nest with test Mongo.
- **E2E tests**: Cypress / Playwright for critical flows (search → book → cancel).
- **Regression suite** runs in CI on every PR.
- **UAT**: structured checklist signed off by client per module.
- **Security tests**: OWASP ZAP scan + dependency audit + manual review of auth/payment flows.
- **Load tests**: k6 or Artillery — target hotel search throughput (e.g., 100 req/s sustained).

### 13.2 Scalability & Performance
- Stateless API servers (multi-instance behind ALB).
- Hot data cached in Redis (search results, hotel details, autocomplete).
- Mongo with proper indexes (see §8.13).
- Asynchronous heavy work via BullMQ: voucher PDF generation, email sending, settlement reminders, report exports.
- Pagination on every list endpoint (default 20, max 100).
- Lazy-loaded Angular modules; SSR for landing page (optional SEO win).
- CDN for static assets (CloudFront).

---

## 14. Required Deliverables (From Client Doc, with detail)

| Category | Deliverable | Notes |
|---|---|---|
| **UI/UX** | Full UI/UX designs | Figma file with all screens, components, design system. |
| | Editable source files | Figma access + exported assets (SVG/PNG). |
| **Frontend** | Responsive client website | Mobile-first; breakpoints 360/768/1024/1440. |
| | Responsive admin panel | Tablet + desktop minimum; mobile nice-to-have. |
| **Backend** | Full backend APIs | OpenAPI/Swagger doc generated. |
| | Authentication system | JWT, refresh, RBAC, password reset, 2FA-ready. |
| | Booking system | Full search→book→cancel lifecycle. |
| | Credit & wallet system | Ledger-correct, idempotent. |
| | Notifications system | In-app + email + SMS dispatchers. |
| **Integrations** | Hotel booking APIs | Min 1 supplier integrated; adapter pattern for more. |
| | Payment gateway | Min 1 gateway, webhooks verified. |
| | Google Maps | Search autocomplete + details map. |
| | Email & SMS | Templated, queued, retryable. |
| **Database** | Architecture & schema | ERD/diagram + Mongoose schemas in code. |
| **Testing** | QA test plan | Test cases per module. |
| | Performance testing | Load test report with metrics. |
| | Security testing | OWASP report + remediations. |
| | Bug fixing | Bugs in tracking tool, all P0/P1 closed pre-launch. |
| **Deployment** | Production deployment | AWS infra (Terraform optional). |
| | AWS setup | VPC, ALB, ECS/EC2, S3, CloudFront, RDS or Atlas peering, SES, Secrets Manager, CloudWatch. |
| | SSL setup | ACM cert, auto-renew, HTTPS-only. |
| **Final Delivery** | Full source code | Monorepo with README per app. |
| | Deployment files | Dockerfiles, docker-compose, IaC, CI/CD workflows. |
| | Technical documentation | README, architecture doc, API doc, runbook, on-call guide. |
| | Production-ready platform | Smoke-tested, monitored, backed up. |

---

## 15. Recommended Build Phases (for Claude Code)

> Build in this order. Each phase is independently demoable.

**Phase 0 — Foundation (1 sprint)**
- Monorepo setup, ESLint, Prettier, Husky, CI skeleton.
- Mongo + Mongoose connection, base config, env handling.
- Auth module (register/login/refresh/reset).
- Angular shells (client + admin) with routing + auth guard + layout.

**Phase 1 — Catalog & Booking Skeleton (2 sprints)**
- Hotel supplier adapter interface + 1 supplier (start with Hotelbeds sandbox or a mock).
- Search → results → details → prebook flows.
- Bookings collection + create/cancel without payment.
- Voucher PDF generation.

**Phase 2 — Payment + Wallet (1–2 sprints)**
- Payment gateway adapter + 1 gateway integration with webhooks.
- Wallet & credit ledger, top-ups, credit-pay flow.
- Settlement recording.

**Phase 3 — Admin Panel Core (2 sprints)**
- Client management, credit management, booking management.
- Sub-admins & roles.
- API integration settings.

**Phase 4 — CMS, Notifications, Reports, Support (1–2 sprints)**
- CMS pages, banners, email templates.
- Notification dispatchers (in-app/email/SMS) + queue.
- Reports + exports.
- Support tickets.

**Phase 5 — Hardening & Launch (1–2 sprints)**
- Security audit, load tests, fix list.
- AWS production setup, CloudFront, SES domain, monitoring.
- UAT with client, documentation, handover.

---

## 16. Open Questions for the Client (Recommended to Clarify Before Build)

1. **Which Hotel API(s)** does the client have credentials for? (Hotelbeds, TBO, RateHawk, others?)
2. **Which Payment Gateway(s)**? Region matters: Razorpay/PayU (India), Stripe (global), PayTabs (MENA), etc.
3. **Currency support**: single currency (e.g., INR or USD) or multi-currency?
4. **Languages / i18n**: English only, or also Arabic/Hindi/etc.?
5. **Markup model**: flat %, per-supplier %, per-hotel override, per-client override?
6. **Credit policy specifics**: interest on overdue? auto-block bookings if outstanding > X days? Hard or soft credit limit?
7. **Tax invoice generation**: needed (GST/VAT-compliant invoices) or just vouchers?
8. **Multi-user per company**: launch with 1-user-per-company or full multi-user from day 1?
9. **Mobile apps**: web-only or need native iOS/Android later? (affects API shape decisions)
10. **Branding**: white-label per business client (their logo on vouchers/emails) or single-brand?
11. **SLA & support hours** required for production?
12. **Backup & DR RPO/RTO targets**?
13. **Compliance requirements**: PCI-DSS scope, GDPR, regional data residency?
14. **Hotel review/feedback** module needed at MVP or later?
15. **Loyalty / reward points** for business clients — needed?

> Claude Code should either ask the user these or assume sensible defaults and document the assumption.

---

## 17. Suggested Default Assumptions (If Client Doesn't Specify)

- Currency: USD primary, INR support
- Hotel API: Hotelbeds (largest catalog, well-documented)
- Payment Gateway: Stripe (global) + Razorpay (India)
- Email: AWS SES
- SMS: Twilio
- Hosting: AWS ECS Fargate behind ALB, MongoDB Atlas, Redis ElastiCache
- One-user-per-company at MVP; data model supports multi-user
- Markup: per-supplier % set in admin panel, overridable per-client
- Credit: hard limit (block new bookings when exceeded)
- i18n: English only at MVP (data model uses translation keys for future)

---

## 18. Quick Glossary (For Anyone Reading This Spec)

- **B2B**: business-to-business; customers here are companies/agents, not end consumers.
- **PMS**: Property Management System (a hotel's own software). Not what we're integrating — we integrate with **aggregators**.
- **GDS / Aggregator**: Hotelbeds, TBO, etc. — they aggregate inventory from many hotels and expose one API.
- **Voucher**: the PDF given to the end guest to check in at the hotel.
- **Prebook**: a temporary rate lock before the actual book call.
- **Markup**: platform's profit margin added on top of supplier net rate.
- **Settlement**: a client's payment that clears outstanding credit usage.
- **Outstanding**: credit balance the client owes the platform.

---

**End of Specification.** Hand this whole file to Claude Code along with the original PDF. Recommend Claude Code reads this spec first, then asks the clarifying questions in §16 before scaffolding the repo.
