import { api } from '../../lib/api-client';

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  jobTitle: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  roles: { id: string; name: string }[];
}

export interface AdminUserDetail extends AdminUser {
  phone: string | null;
  roleIds: string[];
}

export interface CreateUserInput {
  fullName: string;
  email: string;
  password: string;
  jobTitle?: string;
  phone?: string;
  roleIds: string[];
}

export interface UpdateUserInput {
  fullName?: string;
  jobTitle?: string;
  phone?: string;
  isActive?: boolean;
  roleIds?: string[];
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystemRole: boolean;
  permissionIds: string[];
  permissionCodes: string[];
  userCount: number;
}

export interface PermissionCatalogEntry {
  id: string;
  module: string;
  action: string;
  code: string;
  description: string | null;
}

export interface CreateRoleInput {
  name: string;
  description?: string;
  permissionIds: string[];
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissionIds?: string[];
}

export const userManagementApi = {
  listUsers: () => api.get<AdminUser[]>('/users/admin'),
  getUser: (id: string) => api.get<AdminUserDetail>(`/users/${id}`),
  createUser: (input: CreateUserInput) => api.post<AdminUserDetail>('/users', input),
  updateUser: (id: string, input: UpdateUserInput) => api.patch<AdminUserDetail>(`/users/${id}`, input),

  listRoles: () => api.get<Role[]>('/roles'),
  listPermissions: () => api.get<PermissionCatalogEntry[]>('/roles/permissions'),
  createRole: (input: CreateRoleInput) => api.post<Role>('/roles', input),
  updateRole: (id: string, input: UpdateRoleInput) => api.patch<Role>(`/roles/${id}`, input),
};
