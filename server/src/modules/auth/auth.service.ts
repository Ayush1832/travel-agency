import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, UserDocument, UserRole, UserStatus } from '../../db/schemas/user.schema';
import { Company, CompanyDocument, CompanyStatus } from '../../db/schemas/company.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userModel.findOne({ email: dto.email.toLowerCase() });
    if (existing) throw new ConflictException('Email already registered');

    const rounds = this.config.get<number>('bcryptRounds')!;
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    const company = new this.companyModel({
      name: dto.companyName,
      contactPerson: dto.contactPerson,
      email: dto.email.toLowerCase(),
      phone: dto.phone,
      address: {
        line1: dto.addressLine1,
        line2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        country: dto.country,
        postalCode: dto.postalCode,
      },
      taxId: dto.taxId,
      businessRegistrationNo: dto.businessRegistrationNo,
      currency: dto.currency ?? 'AED',
      status: CompanyStatus.PENDING,
    });
    await company.save();

    await new this.userModel({
      companyId: company._id,
      role: UserRole.CLIENT_OWNER,
      firstName: dto.contactPerson.split(' ')[0] ?? dto.contactPerson,
      lastName: dto.contactPerson.split(' ').slice(1).join(' ') || '-',
      email: dto.email.toLowerCase(),
      phone: dto.phone,
      passwordHash,
      status: UserStatus.ACTIVE,
    }).save();

    return { message: 'Registration submitted. Pending admin approval.' };
  }

  async login(dto: LoginDto, ip: string) {
    const user = await this.userModel
      .findOne({ email: dto.email.toLowerCase() })
      .select('+passwordHash')
      .lean();

    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.status !== UserStatus.ACTIVE) throw new ForbiddenException('Account is disabled');

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) throw new UnauthorizedException('Invalid credentials');

    if (user.role === UserRole.CLIENT_OWNER) {
      const company = await this.companyModel.findById(user.companyId).lean();
      if (company?.status === CompanyStatus.PENDING) {
        throw new ForbiddenException('Account pending admin approval');
      }
      if (company?.status === CompanyStatus.SUSPENDED || company?.status === CompanyStatus.REJECTED) {
        throw new ForbiddenException('Account is suspended or rejected');
      }
    }

    const tokens = await this.generateTokens(
      user._id.toString(),
      user.email,
      user.role,
      user.companyId?.toString() ?? null,
    );

    const rounds = this.config.get<number>('bcryptRounds')!;
    const refreshHash = await bcrypt.hash(tokens.refreshToken, rounds);
    await this.userModel.updateOne(
      { _id: user._id },
      { refreshTokenHash: refreshHash, lastLoginAt: new Date(), lastLoginIp: ip },
    );

    return { ...tokens, user: this.sanitizeUser(user) };
  }

  async refresh(userId: string, rawRefreshToken: string) {
    const user = await this.userModel.findById(userId).select('+refreshTokenHash').lean();
    if (!user?.refreshTokenHash) throw new UnauthorizedException();

    const valid = await bcrypt.compare(rawRefreshToken, user.refreshTokenHash);
    if (!valid) throw new UnauthorizedException('Refresh token invalid or expired');

    const tokens = await this.generateTokens(
      user._id.toString(),
      user.email,
      user.role,
      user.companyId?.toString() ?? null,
    );

    const rounds = this.config.get<number>('bcryptRounds')!;
    const newRefreshHash = await bcrypt.hash(tokens.refreshToken, rounds);
    await this.userModel.updateOne({ _id: user._id }, { refreshTokenHash: newRefreshHash });

    return tokens;
  }

  async logout(userId: string) {
    await this.userModel.updateOne({ _id: userId }, { $unset: { refreshTokenHash: '' } });
    return { message: 'Logged out' };
  }

  async forgotPassword(email: string) {
    const user = await this.userModel.findOne({ email: email.toLowerCase() });
    if (!user) return { message: 'If that email exists, a reset link has been sent.' };

    const rawToken = crypto.randomBytes(32).toString('hex');
    const rounds = this.config.get<number>('bcryptRounds')!;
    const tokenHash = await bcrypt.hash(rawToken, rounds);
    const ttlMin = this.config.get<number>('passwordResetTokenTtlMin')!;

    await this.userModel.updateOne(
      { _id: user._id },
      {
        passwordResetToken: tokenHash,
        passwordResetExpiresAt: new Date(Date.now() + ttlMin * 60_000),
      },
    );

    // TODO: send email with rawToken via SES / SendGrid

    return { message: 'If that email exists, a reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const users = await this.userModel
      .find({ passwordResetExpiresAt: { $gt: new Date() } })
      .select('+passwordResetToken')
      .lean();

    let matchedUser: (typeof users)[0] | null = null;
    for (const u of users) {
      if (u.passwordResetToken && (await bcrypt.compare(token, u.passwordResetToken))) {
        matchedUser = u;
        break;
      }
    }

    if (!matchedUser) throw new BadRequestException('Invalid or expired reset token');

    const rounds = this.config.get<number>('bcryptRounds')!;
    const passwordHash = await bcrypt.hash(newPassword, rounds);

    await this.userModel.updateOne(
      { _id: matchedUser._id },
      {
        passwordHash,
        $unset: { passwordResetToken: '', passwordResetExpiresAt: '', refreshTokenHash: '' },
      },
    );

    return { message: 'Password reset successful' };
  }

  async sendVerificationEmail(userId: string): Promise<{ message: string }> {
    const user = await this.userModel.findById(userId).lean();
    if (!user) throw new BadRequestException('User not found');
    if (user.emailVerified) throw new BadRequestException('Email is already verified');

    const rawToken = crypto.randomBytes(32).toString('hex');
    const rounds = this.config.get<number>('bcryptRounds')!;
    const tokenHash = await bcrypt.hash(rawToken, rounds);

    await this.userModel.updateOne(
      { _id: user._id },
      {
        emailVerificationToken: tokenHash,
        emailVerificationExpiresAt: new Date(Date.now() + 24 * 60 * 60_000), // 24 h
      },
    );

    // TODO: deliver rawToken to user (e.g. via NotificationsService / SES)
    // For now we log it in non-production so developers can test the flow
    if (this.config.get('nodeEnv') !== 'production') {
      console.log(`[Auth] Email verification token for ${user.email}: ${rawToken}`);
    }

    return { message: 'Verification email sent. Please check your inbox.' };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    if (!token) throw new BadRequestException('Token is required');

    const users = await this.userModel
      .find({ emailVerificationExpiresAt: { $gt: new Date() } })
      .select('+emailVerificationToken')
      .lean();

    let matchedUser: (typeof users)[0] | null = null;
    for (const u of users) {
      if (
        u.emailVerificationToken &&
        (await bcrypt.compare(token, u.emailVerificationToken))
      ) {
        matchedUser = u;
        break;
      }
    }

    if (!matchedUser) throw new BadRequestException('Invalid or expired verification token');

    await this.userModel.updateOne(
      { _id: matchedUser._id },
      {
        emailVerified: true,
        $unset: { emailVerificationToken: '', emailVerificationExpiresAt: '' },
      },
    );

    return { message: 'Email verified successfully' };
  }

  async getMe(userId: string) {
    const user = await this.userModel.findById(userId).lean();
    if (!user) throw new UnauthorizedException();

    let company = null;
    if (user.companyId) {
      company = await this.companyModel.findById(user.companyId).lean();
    }

    return { user: this.sanitizeUser(user), company };
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    companyId: string | null,
  ) {
    const payload: JwtPayload = { sub: userId, email, role, companyId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload },
        {
          secret: this.config.get<string>('jwt.accessSecret'),
          expiresIn: '15m',
        },
      ),
      this.jwtService.signAsync(
        { ...payload },
        {
          secret: this.config.get<string>('jwt.refreshSecret'),
          expiresIn: '7d',
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: UserDocument | (User & { _id: unknown })) {
    const plain = 'toObject' in user && typeof user.toObject === 'function'
      ? user.toObject()
      : { ...user };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, passwordResetToken, refreshTokenHash, ...safe } = plain as Record<string, unknown>;
    return safe;
  }
}
