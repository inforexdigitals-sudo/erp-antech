import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreateRoleInput, CreateUserInput, UpdateRoleInput, UpdateUserInput, userManagementApi } from './api';

export function useAdminUsers() {
  return useQuery({ queryKey: ['users', 'admin'], queryFn: userManagementApi.listUsers });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => userManagementApi.createUser(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) => userManagementApi.updateUser(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useRoles() {
  return useQuery({ queryKey: ['roles'], queryFn: userManagementApi.listRoles });
}

export function usePermissionCatalog() {
  return useQuery({
    queryKey: ['roles', 'permissions'],
    queryFn: userManagementApi.listPermissions,
    staleTime: 5 * 60_000,
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRoleInput) => userManagementApi.createRole(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRoleInput }) => userManagementApi.updateRole(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}
