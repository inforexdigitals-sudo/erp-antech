import { FormEvent, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ErrorNote, Spinner } from '../components/ui/Feedback';
import { Field, Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useChangePassword, useLogout } from '../features/auth/hooks';
import { ApiError } from '../lib/api-client';
import { useAuthStore } from '../stores/auth-store';
import { useThemeStore } from '../stores/theme-store';
import { cn } from '../lib/utils';
import { NAV_GROUPS } from './nav-config';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      // onSuccess already cleared the session — ProtectedRoute takes it from here.
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change your password.');
    }
  }

  return (
    <Modal open onClose={onClose} title="Change Password">
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <Field label="Current Password" htmlFor="cp-current">
          <Input
            id="cp-current"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </Field>
        <Field label="New Password" htmlFor="cp-new">
          <Input
            id="cp-new"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </Field>
        <Field label="Confirm New Password" htmlFor="cp-confirm">
          <Input
            id="cp-confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </Field>
        <p className="text-xs text-muted">You&apos;ll be signed out here and everywhere else, and need to sign back in with your new password.</p>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={changePassword.isPending}>
            {changePassword.isPending ? 'Changing…' : 'Change Password'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const profile = useAuthStore((s) => s.profile);
  const permissions = useAuthStore((s) => s.permissions);
  const { theme, toggle: toggleTheme } = useThemeStore();
  const logout = useLogout();

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (!item.permissionPrefix) return true;
      const prefixes = Array.isArray(item.permissionPrefix) ? item.permissionPrefix : [item.permissionPrefix];
      return prefixes.some((prefix) => permissions.some((p) => p.startsWith(prefix)));
    }),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          'flex h-screen w-sidebar shrink-0 flex-col border-r border-line bg-surface',
          'fixed inset-y-0 left-0 z-40 -translate-x-full transition-transform lg:static lg:translate-x-0',
          mobileNavOpen && 'translate-x-0 shadow-[0_0_0_100vmax_rgba(0,0,0,0.35)]',
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-[18px] py-3.5">
          <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[7px] bg-accent text-sm font-bold text-white">
            AE
          </div>
          <div>
            <div className="text-[14.5px] font-semibold">Antech ERP</div>
            <div className="text-[11.5px] text-muted">Antech Engineering Pte Ltd</div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2.5">
          {visibleGroups.map((group) => (
            <div key={group.label}>
              <div className="px-2.5 pb-1.5 pt-3.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-2">
                {group.label}
              </div>
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-[13.5px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink',
                      isActive && 'bg-accent-soft text-accent-ink hover:bg-accent-soft hover:text-accent-ink',
                    )
                  }
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2.5 rounded-[7px] p-1.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11.5px] font-bold text-accent-ink">
              {profile ? initials(profile.fullName) : '…'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-semibold">{profile?.fullName ?? 'Loading…'}</div>
              <div className="truncate text-[11px] text-muted">{profile?.roles.join(', ') || profile?.jobTitle}</div>
            </div>
            <button
              onClick={() => setChangingPassword(true)}
              className="rounded p-1 text-muted hover:bg-surface-2 hover:text-ink"
              title="Change password"
              aria-label="Change password"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
                <circle cx="8" cy="15.5" r="3.5" />
                <path d="M10.5 13 18 5.5M18 5.5 21 8.5M18 5.5l2 2" />
              </svg>
            </button>
            <button
              onClick={() => logout.mutate()}
              className="rounded p-1 text-muted hover:bg-surface-2 hover:text-ink"
              title="Log out"
              aria-label="Log out"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
                <path d="M15 4.5H6.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1H15" />
                <path d="M20 12H10.5" />
                <path d="M16.5 8.5 20 12l-3.5 3.5" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} />}

      {mobileNavOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/35 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3.5 border-b border-line bg-surface px-[22px] py-3">
          <button
            className="flex items-center justify-center rounded-[7px] border border-line p-1.5 lg:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-[18px] w-[18px]">
              <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" />
            </svg>
          </button>
          <div className="flex max-w-[360px] flex-1 items-center gap-2 rounded-[7px] border border-line bg-surface-2 px-2.5 py-[7px] text-[13px] text-muted">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-[15px] w-[15px] shrink-0">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="M20 20l-4.8-4.8" />
            </svg>
            <span>Search projects, quotations, POs…</span>
          </div>
          <div className="flex-1" />
          <button
            onClick={toggleTheme}
            className="relative flex h-[34px] w-[34px] items-center justify-center rounded-[7px] border border-transparent text-muted hover:border-line hover:bg-surface-2 hover:text-ink"
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            {theme === 'light' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]">
                <circle cx="12" cy="12" r="4.3" />
                <path d="M12 2.5v2.3M12 19.2v2.3M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.3M19.2 12h2.3M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]">
                <path d="M20 14.2A8.2 8.2 0 1 1 9.8 4a6.6 6.6 0 0 0 10.2 10.2Z" />
              </svg>
            )}
          </button>
        </header>

        <main className="mx-auto w-full max-w-[1320px] flex-1 p-[22px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <Spinner className="h-6 w-6" />
    </div>
  );
}
