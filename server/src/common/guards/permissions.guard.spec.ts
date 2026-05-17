import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSION_KEY } from '../decorators/permissions.decorator';
import { UserRole } from '../../db/schemas/user.schema';
import { Role } from '../../db/schemas/role.schema';

const makeCtx = (user: Record<string, unknown>, handler = jest.fn(), cls = jest.fn()) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => handler,
    getClass: () => cls,
  }) as unknown as ExecutionContext;

const makeRole = (permissions: { module: string; actions: string[] }[]) => ({
  _id: new Types.ObjectId(),
  permissions,
});

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;
  const mockRoleModel = { findById: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsGuard,
        Reflector,
        { provide: getModelToken(Role.name), useValue: mockRoleModel },
      ],
    }).compile();

    guard = module.get<PermissionsGuard>(PermissionsGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  describe('when no @RequirePermission decorator is present', () => {
    it('allows access (returns true)', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      const ctx = makeCtx({ role: UserRole.SUB_ADMIN });
      expect(await guard.canActivate(ctx)).toBe(true);
    });
  });

  describe('SuperAdmin bypass', () => {
    it('allows SUPER_ADMIN regardless of permission', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({ module: 'credit', action: 'edit' });
      const ctx = makeCtx({ role: UserRole.SUPER_ADMIN });
      expect(await guard.canActivate(ctx)).toBe(true);
    });
  });

  describe('Non-admin roles', () => {
    it.each([UserRole.CLIENT, 'agent', 'user'])(
      'throws ForbiddenException for role "%s"',
      async (role) => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({ module: 'clients', action: 'view' });
        const ctx = makeCtx({ role });
        await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      },
    );
  });

  describe('SUB_ADMIN authorization matrix', () => {
    const subRoleId = new Types.ObjectId().toString();

    const cases: Array<{
      label: string;
      module: string;
      action: string;
      grantedPermissions: { module: string; actions: string[] }[];
      expected: boolean;
    }> = [
      {
        label: 'clients:view — granted',
        module: 'clients',
        action: 'view',
        grantedPermissions: [{ module: 'clients', actions: ['view', 'edit'] }],
        expected: true,
      },
      {
        label: 'clients:view — not granted',
        module: 'clients',
        action: 'view',
        grantedPermissions: [{ module: 'credit', actions: ['edit'] }],
        expected: false,
      },
      {
        label: 'credit:edit — granted',
        module: 'credit',
        action: 'edit',
        grantedPermissions: [{ module: 'credit', actions: ['edit', 'view'] }],
        expected: true,
      },
      {
        label: 'credit:edit — has view but not edit',
        module: 'credit',
        action: 'edit',
        grantedPermissions: [{ module: 'credit', actions: ['view'] }],
        expected: false,
      },
      {
        label: 'support:view — module not present at all',
        module: 'support',
        action: 'view',
        grantedPermissions: [{ module: 'clients', actions: ['view'] }],
        expected: false,
      },
      {
        label: 'reports:export — granted with multiple modules',
        module: 'reports',
        action: 'export',
        grantedPermissions: [
          { module: 'clients', actions: ['view'] },
          { module: 'reports', actions: ['view', 'export'] },
        ],
        expected: true,
      },
    ];

    test.each(cases)('$label', async ({ module, action, grantedPermissions, expected }) => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({ module, action });
      const lean = jest.fn().mockResolvedValue(makeRole(grantedPermissions));
      mockRoleModel.findById.mockReturnValue({ lean });

      const ctx = makeCtx({ role: UserRole.SUB_ADMIN, subRoleId });

      if (expected) {
        expect(await guard.canActivate(ctx)).toBe(true);
      } else {
        await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      }
    });
  });

  describe('SUB_ADMIN with no role found', () => {
    it('throws ForbiddenException when subRoleId does not exist in DB', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({ module: 'clients', action: 'view' });
      const lean = jest.fn().mockResolvedValue(null);
      mockRoleModel.findById.mockReturnValue({ lean });

      const ctx = makeCtx({ role: UserRole.SUB_ADMIN, subRoleId: new Types.ObjectId().toString() });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });
});
