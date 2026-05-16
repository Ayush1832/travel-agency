import { SetMetadata } from '@nestjs/common';

export type PermissionModule =
  | 'bookings'
  | 'credit'
  | 'clients'
  | 'cms'
  | 'reports'
  | 'api_settings'
  | 'sub_admin'
  | 'support';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

export interface RequiredPermission {
  module: PermissionModule;
  action: PermissionAction;
}

export const PERMISSION_KEY = 'permission';
export const RequirePermission = (module: PermissionModule, action: PermissionAction) =>
  SetMetadata(PERMISSION_KEY, { module, action });
