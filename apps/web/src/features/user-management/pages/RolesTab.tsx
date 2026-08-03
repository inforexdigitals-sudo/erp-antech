import { FormEvent, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyNote, ErrorNote, Spinner } from '../../../components/ui/Feedback';
import { Field, Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Textarea } from '../../../components/ui/Select';
import { DataTable, Td, Th, TableWrap, Tr } from '../../../components/ui/Table';
import { ApiError } from '../../../lib/api-client';
import { useCreateRole, usePermissionCatalog, useRoles, useUpdateRole } from '../hooks';
import type { PermissionCatalogEntry, Role } from '../api';

function PermissionChecklist({
  catalog,
  selected,
  onChange,
  disabled,
}: {
  catalog: PermissionCatalogEntry[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
}) {
  const grouped = catalog.reduce<Record<string, PermissionCatalogEntry[]>>((acc, p) => {
    (acc[p.module] ??= []).push(p);
    return acc;
  }, {});

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  return (
    <div className="flex max-h-[360px] flex-col gap-3.5 overflow-y-auto rounded border border-line p-3">
      {Object.entries(grouped).map(([moduleName, perms]) => (
        <div key={moduleName}>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-2">
            {moduleName.replace(/_/g, ' ')}
          </div>
          <div className="flex flex-col gap-1">
            {perms.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  disabled={disabled}
                  onChange={() => toggle(p.id)}
                />
                <span className="capitalize">{p.action}</span>
                {p.description && <span className="text-muted">— {p.description}</span>}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RoleForm({
  initial,
  catalog,
  onSubmit,
  submitting,
  error,
}: {
  initial?: Role;
  catalog: PermissionCatalogEntry[];
  onSubmit: (input: { name: string; description?: string; permissionIds: string[] }) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [permissionIds, setPermissionIds] = useState<Set<string>>(new Set(initial?.permissionIds ?? []));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ name, description: description || undefined, permissionIds: Array.from(permissionIds) });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      <Field label="Role Name" htmlFor="role-name">
        <Input id="role-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Description" htmlFor="role-desc">
        <Textarea id="role-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label="Permissions" htmlFor="role-perms">
        <PermissionChecklist catalog={catalog} selected={permissionIds} onChange={setPermissionIds} />
      </Field>
      {error && <p className="text-[12.5px] text-critical">{error}</p>}
      <Button type="submit" variant="primary" disabled={submitting || permissionIds.size === 0} className="self-end">
        {submitting ? 'Saving…' : initial ? 'Save Changes' : 'Create Role'}
      </Button>
    </form>
  );
}

export function RolesTab() {
  const { data: roles, isLoading, error } = useRoles();
  const { data: catalog } = usePermissionCatalog();
  const create = useCreateRole();
  const update = useUpdateRole();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(role: Role) {
    if (role.isSystemRole) return;
    setEditing(role);
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit(input: { name: string; description?: string; permissionIds: string[] }) {
    setFormError(null);
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, input });
      } else {
        await create.mutateAsync(input);
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  return (
    <div>
      <div className="mb-3.5 flex justify-end">
        <Button variant="primary" onClick={openCreate}>+ New Role</Button>
      </div>
      <Card>
        {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
        {error && <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load roles.'}</ErrorNote>}
        {roles && (
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Description</Th>
                  <Th numeric>Permissions</Th>
                  <Th numeric>Users</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {roles.length === 0 && (
                  <tr><td colSpan={5}><EmptyNote>No roles yet.</EmptyNote></td></tr>
                )}
                {roles.map((r) => (
                  <Tr key={r.id} className={r.isSystemRole ? '' : 'cursor-pointer'} onClick={() => openEdit(r)}>
                    <Td className="font-semibold">{r.name}</Td>
                    <Td>{r.description ?? '—'}</Td>
                    <Td numeric>{r.permissionIds.length}</Td>
                    <Td numeric>{r.userCount}</Td>
                    <Td>{r.isSystemRole && <span className="text-xs text-muted">System — not editable</span>}</Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit ${editing.name}` : 'New Role'} size="lg">
        {catalog ? (
          <RoleForm
            initial={editing ?? undefined}
            catalog={catalog}
            onSubmit={handleSubmit}
            submitting={create.isPending || update.isPending}
            error={formError}
          />
        ) : (
          <div className="flex justify-center py-8"><Spinner /></div>
        )}
      </Modal>
    </div>
  );
}
