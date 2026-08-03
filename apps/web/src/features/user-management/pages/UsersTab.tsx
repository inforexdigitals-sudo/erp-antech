import { FormEvent, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyNote, ErrorNote, Spinner } from '../../../components/ui/Feedback';
import { Field, Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Pill } from '../../../components/ui/Pill';
import { DataTable, Td, Th, TableWrap, Tr } from '../../../components/ui/Table';
import { ApiError } from '../../../lib/api-client';
import { formatDate } from '../../../lib/utils';
import { useAuthStore } from '../../../stores/auth-store';
import { useAdminUsers, useCreateUser, useRoles, useUpdateUser } from '../hooks';
import type { AdminUser, Role } from '../api';

function RolePicker({ roles, selected, onChange }: { roles: Role[]; selected: Set<string>; onChange: (next: Set<string>) => void }) {
  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-1.5 rounded border border-line p-3">
      {roles.length === 0 && <p className="text-[13px] text-muted">No roles exist yet — create one first, under the Roles tab.</p>}
      {roles.map((r) => (
        <label key={r.id} className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
          <span className="font-medium">{r.name}</span>
          {r.description && <span className="text-muted">— {r.description}</span>}
        </label>
      ))}
    </div>
  );
}

function CreateUserModal({ open, onClose, roles }: { open: boolean; onClose: () => void; roles: Role[] }) {
  const create = useCreateUser();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [roleIds, setRoleIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({
        fullName,
        email,
        password,
        jobTitle: jobTitle || undefined,
        phone: phone || undefined,
        roleIds: Array.from(roleIds),
      });
      setFullName('');
      setEmail('');
      setPassword('');
      setJobTitle('');
      setPhone('');
      setRoleIds(new Set());
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create this user.');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New User" size="lg">
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Full Name" htmlFor="u-name">
            <Input id="u-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field label="Email" htmlFor="u-email">
            <Input id="u-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Initial Password" htmlFor="u-password">
            <Input
              id="u-password"
              type="text"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </Field>
          <Field label="Job Title" htmlFor="u-title">
            <Input id="u-title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          </Field>
          <Field label="Phone" htmlFor="u-phone">
            <Input id="u-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>
        <Field label="Roles" htmlFor="u-roles">
          <RolePicker roles={roles} selected={roleIds} onChange={setRoleIds} />
        </Field>
        <p className="text-xs text-muted">
          Share the email and initial password with them directly — there&apos;s no invite email yet, so they&apos;ll
          sign in with exactly what you set here.
        </p>
        {error && <p className="text-[12.5px] text-critical">{error}</p>}
        <Button type="submit" variant="primary" disabled={create.isPending || roleIds.size === 0} className="self-end">
          {create.isPending ? 'Creating…' : 'Create User'}
        </Button>
      </form>
    </Modal>
  );
}

function EditUserModal({ user, roles, onClose }: { user: AdminUser; roles: Role[]; onClose: () => void }) {
  const update = useUpdateUser();
  const currentUserId = useAuthStore((s) => s.profile?.id);
  const [fullName, setFullName] = useState(user.fullName);
  const [jobTitle, setJobTitle] = useState(user.jobTitle ?? '');
  const [isActive, setIsActive] = useState(user.isActive);
  const [roleIds, setRoleIds] = useState<Set<string>>(new Set(user.roles.map((r) => r.id)));
  const [error, setError] = useState<string | null>(null);
  const isSelf = user.id === currentUserId;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await update.mutateAsync({
        id: user.id,
        input: { fullName, jobTitle: jobTitle || undefined, isActive, roleIds: Array.from(roleIds) },
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save these changes.');
    }
  }

  return (
    <Modal open onClose={onClose} title={`Edit ${user.fullName}`} size="lg">
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Full Name" htmlFor="eu-name">
            <Input id="eu-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field label="Job Title" htmlFor="eu-title">
            <Input id="eu-title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={isActive}
            disabled={isSelf}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active
          {isSelf && <span className="text-muted">(you can&apos;t deactivate your own account)</span>}
        </label>
        <Field label="Roles" htmlFor="eu-roles">
          <RolePicker roles={roles} selected={roleIds} onChange={setRoleIds} />
        </Field>
        {error && <p className="text-[12.5px] text-critical">{error}</p>}
        <Button type="submit" variant="primary" disabled={update.isPending || (isSelf && roleIds.size === 0)} className="self-end">
          {update.isPending ? 'Saving…' : 'Save Changes'}
        </Button>
      </form>
    </Modal>
  );
}

export function UsersTab() {
  const { data: users, isLoading, error } = useAdminUsers();
  const { data: roles } = useRoles();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);

  return (
    <div>
      <div className="mb-3.5 flex justify-end">
        <Button variant="primary" onClick={() => setCreateOpen(true)}>+ New User</Button>
      </div>
      <Card>
        {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
        {error && <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load users.'}</ErrorNote>}
        {users && (
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Roles</Th>
                  <Th>Status</Th>
                  <Th>Last Login</Th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr><td colSpan={5}><EmptyNote>No users yet.</EmptyNote></td></tr>
                )}
                {users.map((u) => (
                  <Tr key={u.id} className="cursor-pointer" onClick={() => setEditing(u)}>
                    <Td>
                      <div className="font-semibold">{u.fullName}</div>
                      {u.jobTitle && <div className="text-xs text-muted">{u.jobTitle}</div>}
                    </Td>
                    <Td>{u.email}</Td>
                    <Td>{u.roles.map((r) => r.name).join(', ') || '—'}</Td>
                    <Td><Pill tone={u.isActive ? 'success' : 'neutral'}>{u.isActive ? 'Active' : 'Inactive'}</Pill></Td>
                    <Td>{u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Never'}</Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
        )}
      </Card>

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} roles={roles ?? []} />
      {editing && <EditUserModal user={editing} roles={roles ?? []} onClose={() => setEditing(null)} />}
    </div>
  );
}
