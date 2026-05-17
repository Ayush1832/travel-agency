import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserRole, UserStatus } from '../../db/schemas/user.schema';
import { Company, CompanyStatus } from '../../db/schemas/company.schema';
import { AuthService } from './auth.service';
import { NotificationsService } from '../notifications/notifications.service';

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    email: 'test@example.com',
    role: UserRole.CLIENT_OWNER,
    companyId: new Types.ObjectId(),
    status: UserStatus.ACTIVE,
    passwordHash: bcrypt.hashSync('password123', 1), // low rounds for test speed
    failedLoginAttempts: 0,
    lockedUntil: undefined,
    ...overrides,
  };
}

describe('AuthService — account lockout', () => {
  let service: AuthService;
  let userModel: jest.Mocked<any>;
  let companyModel: jest.Mocked<any>;
  let jwtService: jest.Mocked<Partial<JwtService>>;

  beforeEach(async () => {
    const mockUser = makeUser();

    userModel = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockUser) }),
      }),
      updateOne: jest.fn().mockResolvedValue({}),
    };

    companyModel = {
      findById: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ status: CompanyStatus.ACTIVE }) }),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock-token'),
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Company.name), useValue: companyModel },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockImplementation((key: string) => {
            if (key === 'bcryptRounds') return 1;
            if (key === 'jwt.accessSecret') return 'test-secret';
            if (key === 'jwt.refreshSecret') return 'test-refresh-secret';
            return null;
          }) },
        },
        { provide: NotificationsService, useValue: { send: jest.fn() } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('allows login with correct credentials', async () => {
    const result = await service.login({ email: 'test@example.com', password: 'password123' }, '127.0.0.1');
    expect(result.accessToken).toBe('mock-token');
  });

  it('rejects wrong password and increments failedLoginAttempts', async () => {
    await expect(service.login({ email: 'test@example.com', password: 'wrong' }, '127.0.0.1')).rejects.toThrow(UnauthorizedException);
    expect(userModel.updateOne).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ failedLoginAttempts: 1 }),
    );
  });

  it('locks account after 5 failed attempts', async () => {
    userModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(makeUser({ failedLoginAttempts: 4 })) }),
    });
    await expect(service.login({ email: 'test@example.com', password: 'wrong' }, '127.0.0.1')).rejects.toThrow(UnauthorizedException);
    // Should set lockedUntil on the 5th failed attempt
    const updateCall = userModel.updateOne.mock.calls[0][1];
    expect(updateCall.lockedUntil).toBeInstanceOf(Date);
  });

  it('rejects login when account is locked', async () => {
    const futureDate = new Date(Date.now() + 900000); // 15 min from now
    userModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(makeUser({ lockedUntil: futureDate })) }),
    });
    await expect(service.login({ email: 'test@example.com', password: 'password123' }, '127.0.0.1')).rejects.toThrow(ForbiddenException);
  });

  it('allows login after lockout period expires', async () => {
    const pastDate = new Date(Date.now() - 1000); // already expired
    userModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(makeUser({ lockedUntil: pastDate, failedLoginAttempts: 5 })) }),
    });
    const result = await service.login({ email: 'test@example.com', password: 'password123' }, '127.0.0.1');
    expect(result.accessToken).toBe('mock-token');
  });

  it('resets failedLoginAttempts on successful login', async () => {
    await service.login({ email: 'test@example.com', password: 'password123' }, '127.0.0.1');
    const updateCall = userModel.updateOne.mock.calls[0][1];
    expect(updateCall.failedLoginAttempts).toBe(0);
  });
});
