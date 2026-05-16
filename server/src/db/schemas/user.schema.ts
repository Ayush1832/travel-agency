import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

export enum UserRole {
  CLIENT_OWNER = 'client_owner',
  SUPER_ADMIN = 'super_admin',
  SUB_ADMIN = 'sub_admin',
}

export enum UserStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
}

@Schema({ timestamps: true })
export class User {
  /** Null for admin users */
  @Prop({ type: Types.ObjectId, ref: 'Company', default: null }) companyId: Types.ObjectId | null;

  @Prop({ type: String, enum: Object.values(UserRole), required: true }) role: UserRole;

  /** Sub-admin role reference — populated only when role === sub_admin */
  @Prop({ type: Types.ObjectId, ref: 'Role', default: null }) subRoleId: Types.ObjectId | null;

  @Prop({ required: true }) firstName: string;

  @Prop({ required: true }) lastName: string;

  @Prop({ required: true, unique: true, lowercase: true }) email: string;

  @Prop() phone?: string;

  @Prop({ required: true, select: false }) passwordHash: string;

  @Prop({ type: String, enum: Object.values(UserStatus), default: UserStatus.ACTIVE }) status: UserStatus;

  @Prop({ default: false }) emailVerified: boolean;

  @Prop({ default: false }) twoFactorEnabled: boolean;

  /** Hashed reset token stored for password-reset flow */
  @Prop({ select: false }) passwordResetToken?: string;

  @Prop() passwordResetExpiresAt?: Date;

  /** Hashed token for email-verification flow */
  @Prop({ select: false }) emailVerificationToken?: string;

  @Prop() emailVerificationExpiresAt?: Date;

  /** Hashed refresh token for rotation */
  @Prop({ select: false }) refreshTokenHash?: string;

  @Prop() lastLoginAt?: Date;

  @Prop() lastLoginIp?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ companyId: 1 });
UserSchema.index({ role: 1 });
