/**
 * One-time bootstrap script — creates the first SUPER_ADMIN user if none exists.
 * Run with:  npx ts-node -r tsconfig-paths/register src/seeds/seed-admin.ts
 */
import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/travel-b2b';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@travelb2b.ae';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123456';
const BCRYPT_ROUNDS = 12;

const UserSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, default: null },
    role: { type: String, required: true },
    subRoleId: { type: mongoose.Schema.Types.ObjectId, default: null },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String },
    passwordHash: { type: String, required: true },
    status: { type: String, default: 'active' },
    emailVerified: { type: Boolean, default: true },
    twoFactorEnabled: { type: Boolean, default: false },
    passwordResetToken: { type: String },
    passwordResetExpiresAt: { type: Date },
    refreshTokenHash: { type: String },
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },
  },
  { timestamps: true },
);

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB:', MONGO_URI);

  const UserModel = mongoose.model('User', UserSchema);

  const existing = await UserModel.findOne({ role: 'super_admin' });
  if (existing) {
    console.log('Super admin already exists:', existing.email);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);

  await UserModel.create({
    companyId: null,
    role: 'super_admin',
    subRoleId: null,
    firstName: 'Super',
    lastName: 'Admin',
    email: ADMIN_EMAIL,
    passwordHash,
    status: 'active',
    emailVerified: true,
  });

  console.log('✓ Super admin created');
  console.log('  Email   :', ADMIN_EMAIL);
  console.log('  Password:', ADMIN_PASSWORD);
  console.log('  Change the password immediately after first login!');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
