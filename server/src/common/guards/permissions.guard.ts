import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PERMISSION_KEY, RequiredPermission } from '../decorators/permissions.decorator';
import { UserRole } from '../../db/schemas/user.schema';
import { Role } from '../../db/schemas/role.schema';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectModel(Role.name) private roleModel: Model<Role>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredPermission>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required) return true;

    const { user } = context.switchToHttp().getRequest();

    if (user?.role === UserRole.SUPER_ADMIN) return true;

    if (user?.role !== UserRole.SUB_ADMIN) throw new ForbiddenException('Insufficient permissions');

    const role = await this.roleModel.findById(user.subRoleId).lean();
    if (!role) throw new ForbiddenException('Role not found');

    const modulePerms = role.permissions.find((p) => p.module === required.module);
    if (!modulePerms?.actions.includes(required.action)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
