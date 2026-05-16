export type UserRole = 'client_owner' | 'super_admin' | 'sub_admin';
export type UserStatus = 'active' | 'disabled';

export interface User {
  _id: string;
  companyId: string | null;
  role: UserRole;
  subRoleId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  status: UserStatus;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  user: Omit<User, 'passwordHash'>;
}
