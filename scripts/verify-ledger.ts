/**
 * Ledger conservation verifier.
 *
 * Connects to MongoDB via MONGO_URI and runs three financial consistency assertions:
 *
 *   1. Per-company wallet ledger == outstandingBalance
 *   2. Credit bookings have exactly one matching debit wallet entry of the right amount
 *   3. Online bookings have exactly one successful payment of the right amount
 *
 * Exit 0 — all assertions pass (prints PASSED + counts)
 * Exit 1 — any assertion fails (prints per-violation details + summary)
 */

import mongoose, { Types } from 'mongoose';

// ── Minimal schemas (enough to query, no validation needed) ───────────────────

const CompanySchema = new mongoose.Schema({
  name: String,
  outstandingBalance: { type: Number, default: 0 },
}, { strict: false });

const WalletTransactionSchema = new mongoose.Schema({
  companyId: { type: Types.ObjectId },
  direction: String,   // 'debit' | 'credit'
  amount: Number,
  refBookingId: { type: Types.ObjectId },
}, { strict: false });

const BookingSchema = new mongoose.Schema({
  companyId: { type: Types.ObjectId },
  bookingRef: String,
  paymentMethod: String,   // 'credit' | 'online'
  status: String,          // 'confirmed' | 'completed' | 'cancelled' | ...
  totalAmount: Number,
}, { strict: false });

const PaymentSchema = new mongoose.Schema({
  bookingId: { type: Types.ObjectId },
  status: String,    // 'success' | 'pending' | 'failed'
  amount: Number,
}, { strict: false });

// ── Violation accumulators ────────────────────────────────────────────────────

const violations: { assertion: number; message: string }[] = [];

function fail(assertion: number, message: string) {
  violations.push({ assertion, message });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI environment variable is required');
    process.exit(1);
  }

  console.log(`Connecting to ${mongoUri} ...`);
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10_000 });
  console.log('Connected.\n');

  const Company = mongoose.model('Company', CompanySchema);
  const WalletTx = mongoose.model('WalletTransaction', WalletTransactionSchema);
  const Booking = mongoose.model('Booking', BookingSchema);
  const Payment = mongoose.model('Payment', PaymentSchema);

  // ── Assertion 1: Per-company ledger == outstandingBalance ────────────────────
  console.log('Checking Assertion 1 — per-company ledger balance ...');

  const companies = await Company.find({}).lean();
  let a1Checked = 0;
  let a1Mismatches = 0;

  for (const company of companies) {
    const id = company._id as Types.ObjectId;

    // Only credit_use (debit) and credit_refund (credit) affect outstandingBalance.
    // adjustment entries change creditLimit; settlement/top_up change walletBalance.
    const [debitAgg, creditAgg] = await Promise.all([
      WalletTx.aggregate([
        { $match: { companyId: id, type: 'credit_use', direction: 'debit' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      WalletTx.aggregate([
        { $match: { companyId: id, type: 'credit_refund', direction: 'credit' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const debits = debitAgg[0]?.total ?? 0;
    const credits = creditAgg[0]?.total ?? 0;
    const expected = debits - credits;
    const actual: number = (company as any).outstandingBalance ?? 0;

    if (expected !== actual) {
      fail(1, `Company ${id} (${company.name ?? 'unnamed'}): ledger says ${expected}, outstandingBalance says ${actual}, delta ${expected - actual}`);
      a1Mismatches++;
    }
    a1Checked++;
  }
  console.log(`  Companies checked: ${a1Checked} (${a1Mismatches} mismatch${a1Mismatches !== 1 ? 'es' : ''})`);

  // ── Assertion 2: Credit bookings have exactly one matching debit ────────────
  console.log('Checking Assertion 2 — credit booking ledger entries ...');

  const creditBookings = await Booking.find({
    paymentMethod: 'credit',
    status: { $in: ['confirmed', 'completed'] },
  }).lean();
  let a2Checked = 0;
  let a2Mismatches = 0;

  for (const booking of creditBookings) {
    const bid = booking._id as Types.ObjectId;
    const ref: string = (booking as any).bookingRef ?? String(bid);
    const expectedAmount: number = (booking as any).totalAmount ?? 0;

    const matches = await WalletTx.find({
      refBookingId: bid,
      direction: 'debit',
    }).lean();

    if (matches.length !== 1) {
      fail(2, `Booking ${ref}: expected 1 credit-debit ledger entry, found ${matches.length}`);
      a2Mismatches++;
    } else if ((matches[0] as any).amount !== expectedAmount) {
      fail(2, `Booking ${ref}: ledger entry amount ${(matches[0] as any).amount} != booking amount ${expectedAmount}`);
      a2Mismatches++;
    }
    a2Checked++;
  }
  console.log(`  Credit bookings checked: ${a2Checked} (${a2Mismatches} mismatch${a2Mismatches !== 1 ? 'es' : ''})`);

  // ── Assertion 3: Online bookings have exactly one successful payment ──────────
  console.log('Checking Assertion 3 — online booking payments ...');

  const onlineBookings = await Booking.find({
    paymentMethod: 'online',
    status: 'confirmed',
  }).lean();
  let a3Checked = 0;
  let a3Mismatches = 0;

  for (const booking of onlineBookings) {
    const bid = booking._id as Types.ObjectId;
    const ref: string = (booking as any).bookingRef ?? String(bid);
    const expectedAmount: number = (booking as any).totalAmount ?? 0;

    const matches = await Payment.find({
      bookingId: bid,
      status: 'success',
    }).lean();

    if (matches.length !== 1) {
      fail(3, `Booking ${ref}: expected 1 successful payment, found ${matches.length}`);
      a3Mismatches++;
    } else if ((matches[0] as any).amount !== expectedAmount) {
      fail(3, `Booking ${ref}: payment amount ${(matches[0] as any).amount} != booking amount ${expectedAmount}`);
      a3Mismatches++;
    }
    a3Checked++;
  }
  console.log(`  Online bookings checked: ${a3Checked} (${a3Mismatches} mismatch${a3Mismatches !== 1 ? 'es' : ''})`);

  await mongoose.disconnect();

  // ── Output ───────────────────────────────────────────────────────────────────
  console.log('');

  if (violations.length === 0) {
    console.log('Ledger verification PASSED');
    console.log(`- Companies checked: ${a1Checked}`);
    console.log(`- Credit bookings checked: ${a2Checked}`);
    console.log(`- Online bookings checked: ${a3Checked}`);
    process.exit(0);
  }

  console.log(`Ledger verification FAILED — ${violations.length} violation(s)\n`);

  const byAssertion = [1, 2, 3].map((n) => violations.filter((v) => v.assertion === n));

  const headers = [
    'Assertion 1 — Per-company ledger:',
    'Assertion 2 — Credit booking ledger entries:',
    'Assertion 3 — Online payment matches:',
  ];

  for (let i = 0; i < 3; i++) {
    if (byAssertion[i].length > 0) {
      console.log(headers[i]);
      byAssertion[i].forEach((v) => console.log(`  ${v.message}`));
      console.log('');
    }
  }

  console.log('Summary:');
  console.log(`- Companies checked: ${a1Checked} (${a1Mismatches} mismatch${a1Mismatches !== 1 ? 'es' : ''})`);
  console.log(`- Credit bookings checked: ${a2Checked} (${a2Mismatches} mismatch${a2Mismatches !== 1 ? 'es' : ''})`);
  console.log(`- Online bookings checked: ${a3Checked} (${a3Mismatches} mismatch${a3Mismatches !== 1 ? 'es' : ''})`);

  process.exit(1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
