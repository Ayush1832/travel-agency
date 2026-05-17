/**
 * Playwright global setup — runs once before all E2E specs.
 *
 * Responsibilities:
 *  1. Start the TBO mock SOAP server on port 5099
 *  2. Reset the E2E MongoDB database
 *  3. Seed super-admin user
 *  4. Seed test companies and users needed by the four specs
 *
 * The seeded credentials are written to a JSON file that specs can read via
 * the `E2E_SEED_FILE` environment variable (default: e2e/seed-data.json).
 */

import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

// ── Constants ────────────────────────────────────────────────────────────────

const MONGO_URI = process.env.E2E_MONGO_URI ?? 'mongodb://localhost:27018/travel-b2b-e2e?replicaSet=rs0';
const SEED_FILE = path.join(__dirname, 'seed-data.json');
const BCRYPT_ROUNDS = 10;

// ── Schemas (minimal — just enough to insert documents) ──────────────────────

const UserSchema = new mongoose.Schema({
  companyId: { type: mongoose.Types.ObjectId, default: null },
  role: String,
  subRoleId: { type: mongoose.Types.ObjectId, default: null },
  firstName: String,
  lastName: String,
  email: { type: String, lowercase: true },
  phone: String,
  passwordHash: { type: String, select: false },
  status: { type: String, default: 'active' },
  emailVerified: { type: Boolean, default: true },
  failedLoginAttempts: { type: Number, default: 0 },
}, { timestamps: true });

const CompanySchema = new mongoose.Schema({
  name: String,
  contactPerson: String,
  email: { type: String, lowercase: true },
  phone: String,
  address: {
    line1: String,
    city: String,
    country: String,
    postalCode: String,
  },
  taxId: String,
  status: { type: String, default: 'pending' },
  creditLimit: { type: Number, default: 0 },
  walletBalance: { type: Number, default: 0 },
  outstandingBalance: { type: Number, default: 0 },
  loyaltyPoints: { type: Number, default: 0 },
  currency: { type: String, default: 'AED' },
}, { timestamps: true });

const RoleSchema = new mongoose.Schema({
  name: String,
  description: String,
  permissions: [{
    module: String,
    actions: [String],
  }],
  isSystem: { type: Boolean, default: false },
}, { timestamps: true });

// ── Helpers ───────────────────────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

let mockSoapProcess: ChildProcess | null = null;

function startMockSoapServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, 'mock-soap-server.js');
    mockSoapProcess = spawn('node', [serverPath], {
      env: { ...process.env, MOCK_SOAP_PORT: '5099' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    mockSoapProcess.stdout?.on('data', (data: Buffer) => {
      const msg = data.toString();
      if (msg.includes('listening on port')) {
        console.log('[global-setup] Mock SOAP server started on port 5099');
        resolve();
      }
    });

    mockSoapProcess.stderr?.on('data', (data: Buffer) => {
      console.error('[mock-soap]', data.toString());
    });

    mockSoapProcess.on('error', reject);

    setTimeout(() => resolve(), 2000); // fallback: assume started
  });
}

// ── Main global setup ─────────────────────────────────────────────────────────

export default async function globalSetup() {
  // 1. Start mock SOAP server
  await startMockSoapServer();

  // 2. Connect to E2E database
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('[global-setup] Connected to MongoDB:', MONGO_URI);

  // 3. Drop and recreate the database
  await mongoose.connection.dropDatabase();
  console.log('[global-setup] Database cleared');

  const User = mongoose.model('User', UserSchema);
  const Company = mongoose.model('Company', CompanySchema);
  const Role = mongoose.model('Role', RoleSchema);

  // 4. Seed super-admin
  const superAdminPw = 'Admin@E2E2026!';
  const superAdmin = await User.create({
    role: 'super_admin',
    firstName: 'Super',
    lastName: 'Admin',
    email: 'superadmin@e2e.travel',
    phone: '+971500000000',
    passwordHash: await hashPassword(superAdminPw),
    status: 'active',
    emailVerified: true,
  });
  console.log('[global-setup] Super-admin seeded:', superAdmin.email);

  // 5. Seed pending company for admin-operational-flow spec (Spec 2)
  const pendingCompany = await Company.create({
    name: 'ACME Travel E2E',
    contactPerson: 'Alice Pending',
    email: 'acme-e2e@travel.test',
    phone: '+971501111111',
    address: { line1: '100 Business Bay', city: 'Dubai', country: 'AE', postalCode: '00000' },
    taxId: 'TAX-E2E-001',
    status: 'pending',
    currency: 'AED',
  });
  const pendingCompanyUser = await User.create({
    companyId: pendingCompany._id,
    role: 'client_owner',
    firstName: 'Alice',
    lastName: 'Pending',
    email: 'alice@acme-e2e.travel',
    phone: '+971501111111',
    passwordHash: await hashPassword('Client@E2E2026!'),
    status: 'active',
    emailVerified: true,
  });
  console.log('[global-setup] Pending company seeded:', pendingCompany.name);

  // 6. Seed Finance sub-admin role and user for Spec 3 (RBAC)
  const financeRole = await Role.create({
    name: 'Finance E2E',
    description: 'Finance role — can view credit/reports, not CMS/sub-admins',
    permissions: [
      { module: 'credit', actions: ['read'] },
      { module: 'reports', actions: ['read'] },
      { module: 'bookings', actions: ['read'] },
      { module: 'clients', actions: ['read'] },
    ],
    isSystem: false,
  });
  const financeSubAdminPw = 'Finance@E2E2026!';
  await User.create({
    role: 'sub_admin',
    subRoleId: financeRole._id,
    firstName: 'Finance',
    lastName: 'SubAdmin',
    email: 'finance@e2e.travel',
    phone: '+971502222222',
    passwordHash: await hashPassword(financeSubAdminPw),
    status: 'active',
    emailVerified: true,
  });
  console.log('[global-setup] Finance sub-admin seeded');

  // 7. Seed Company A and Company B (active, with credit) for Spec 4 (cross-tenant)
  const [companyA, companyB] = await Promise.all([
    Company.create({
      name: 'Company Alpha E2E',
      contactPerson: 'Alpha Owner',
      email: 'alpha-e2e@travel.test',
      phone: '+971503333333',
      address: { line1: '200 DIFC', city: 'Dubai', country: 'AE', postalCode: '00000' },
      status: 'active',
      creditLimit: 5000000,
      currency: 'AED',
    }),
    Company.create({
      name: 'Company Beta E2E',
      contactPerson: 'Beta Owner',
      email: 'beta-e2e@travel.test',
      phone: '+971504444444',
      address: { line1: '300 JBR', city: 'Dubai', country: 'AE', postalCode: '00000' },
      status: 'active',
      creditLimit: 5000000,
      currency: 'AED',
    }),
  ]);

  const [userA, userB] = await Promise.all([
    User.create({
      companyId: companyA._id,
      role: 'client_owner',
      firstName: 'Alpha',
      lastName: 'User',
      email: 'user@alpha-e2e.travel',
      phone: '+971503333334',
      passwordHash: await hashPassword('Alpha@E2E2026!'),
      status: 'active',
      emailVerified: true,
    }),
    User.create({
      companyId: companyB._id,
      role: 'client_owner',
      firstName: 'Beta',
      lastName: 'User',
      email: 'user@beta-e2e.travel',
      phone: '+971504444445',
      passwordHash: await hashPassword('Beta@E2E2026!'),
      status: 'active',
      emailVerified: true,
    }),
  ]);
  console.log('[global-setup] Cross-tenant companies seeded');

  // 8. Write seed data to file for specs to consume
  const seedData = {
    superAdmin: { email: superAdmin.email, password: superAdminPw, id: String(superAdmin._id) },
    pendingCompany: {
      id: String(pendingCompany._id),
      name: pendingCompany.name,
      user: { email: pendingCompanyUser.email, password: 'Client@E2E2026!', id: String(pendingCompanyUser._id) },
    },
    financeSubAdmin: { email: 'finance@e2e.travel', password: financeSubAdminPw },
    companyA: {
      id: String(companyA._id),
      name: companyA.name,
      user: { email: userA.email, password: 'Alpha@E2E2026!', id: String(userA._id) },
    },
    companyB: {
      id: String(companyB._id),
      name: companyB.name,
      user: { email: userB.email, password: 'Beta@E2E2026!', id: String(userB._id) },
    },
  };

  fs.writeFileSync(SEED_FILE, JSON.stringify(seedData, null, 2));
  console.log('[global-setup] Seed data written to', SEED_FILE);

  await mongoose.disconnect();
  console.log('[global-setup] Setup complete');

  // Store reference for teardown
  (globalThis as any).__mockSoapProcess = mockSoapProcess;
}
