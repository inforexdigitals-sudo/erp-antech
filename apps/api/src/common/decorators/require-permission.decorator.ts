import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'requiredPermission';

/**
 * @RequirePermission('quotation.approve') — checked by PermissionsGuard
 * against the permission codes embedded in the caller's access token.
 * Codes must match db/migrations/0016_seed_permissions.sql.
 */
export const RequirePermission = (permissionCode: string) =>
  SetMetadata(PERMISSION_KEY, permissionCode);
