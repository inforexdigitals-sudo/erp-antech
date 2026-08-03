# dashboard feature

Built — Phase 6 batch 1. See [apps/web/README.md](../../../README.md) for
what's verified and what isn't.

- `api.ts` — typed wrappers for all nine `GET /dashboard/*` endpoints.
- `hooks.ts` — one TanStack Query hook per endpoint.
- `pages/DashboardPage.tsx` — composes them; each section has its own
  loading/error state so one slow widget doesn't block the page.

Mirrors the backend module at `apps/api/src/modules/dashboard/`.
