# API Architecture

REST, versioned, resource-oriented, one controller set per module
(mirrors [folder-structure.md](folder-structure.md)). OpenAPI/Swagger is
auto-generated from NestJS decorators and served at `/api/docs` (gated
behind auth outside local dev).

## 1. Conventions

- **Base path:** `/api/v1/...`. A breaking change to a resource gets a
  `/api/v2/...` sibling, not a mutation of `v1` — existing integrations
  (portal clients, accounting adapters) don't break silently.
- **Resource routes**, standard CRUD shape per module, e.g. for Quotations:
  ```
  GET    /api/v1/quotations              list (paginated, filterable, sortable)
  POST   /api/v1/quotations               create (draft)
  GET    /api/v1/quotations/:id           fetch one
  PATCH  /api/v1/quotations/:id           partial update
  DELETE /api/v1/quotations/:id           soft delete (where applicable)
  ```
- **Workflow/action routes** for state transitions that are not plain
  field edits — these carry business meaning and audit differently than
  a PATCH:
  ```
  POST /api/v1/quotations/:id/revisions            new revision
  POST /api/v1/quotations/:id/submit-for-approval
  POST /api/v1/quotations/:id/approve
  POST /api/v1/quotations/:id/reject
  POST /api/v1/quotations/:id/send                 email to customer
  POST /api/v1/quotations/:id/convert-to-project    FR-3.7
  ```
  The same pattern applies to POs (`/issue`, `/receive`), claims
  (`/submit`, `/certify`), VOs (`/approve`), timesheets (`/approve`), etc.
- **Nested resources** only one level deep, and only where the child
  never makes sense outside its parent (e.g.
  `POST /api/v1/quotations/:id/items`). Anything queryable on its own
  (documents, communications) is a top-level resource filtered by a
  `relatedEntityType`/`relatedEntityId` query param instead of forced
  into every possible parent's URL space.

## 2. Pagination, Filtering, Sorting

- **List endpoints default to offset/limit** (`?page=1&pageSize=25`),
  matching typical admin-UI table paging.
- **High-volume ledger endpoints** (`stock-transactions`,
  `cost-transactions`, `audit-logs`) use **cursor pagination**
  (`?cursor=<opaque>&limit=50`) — offset pagination degrades badly past
  tens of thousands of rows, and these tables are append-only by design
  (Phase 2), which cursor pagination suits naturally.
- **Filtering** via query params matched to indexed columns
  (`?status=pending_approval&projectId=...`) — every filterable field
  corresponds to an index from Phase 2, so filtering never forces a
  sequential scan.
- **Sorting** via `?sort=-createdAt` (`-` prefix = descending), limited
  to an explicit allow-list of sortable columns per endpoint (prevents
  sorting on unindexed/expensive columns).
- List responses use an envelope:
  ```json
  { "data": [...], "meta": { "total": 123, "page": 1, "pageSize": 25 } }
  ```

## 3. AuthN / AuthZ

- **Access token:** short-lived JWT (15 min), returned on login, carries
  `userId`, `companyId`, and a compact permission-set claim (or role
  IDs, resolved server-side against a Redis-cached permission set —
  avoids a DB round trip per request while staying revocable).
- **Refresh token:** longer-lived, rotated on each use, stored in an
  httpOnly + Secure + SameSite=Strict cookie — never accessible to JS,
  limiting the blast radius of an XSS bug.
- **2FA:** login returns a `requires2fa` challenge state; a second
  `/api/v1/auth/2fa/verify` call with the TOTP code completes login.
  Enforceable per-role via `settings` (FR-16.5).
- **Portal accounts** (clients/suppliers/subcontractors) authenticate
  through the same `/api/v1/auth/login` endpoint but receive a JWT
  scoped to `partyType`/`partyId` instead of `userId` — the same Guard
  infrastructure applies, just with a narrower permission set (view own
  records, approve own quotations/claims) rather than a separate API.
- **`TenantGuard`** (global): every authenticated request resolves
  `companyId` from the JWT, never from the request body/path/query. A
  request for another company's record 404s, not 403s — existence isn't
  leaked across tenants.
- **`PermissionsGuard`** + `@RequirePermission('quotation.approve')`
  decorator on each route, checked against the `permissions` catalog
  seeded in Phase 2 (`db/migrations/0016_seed_permissions.sql`).

## 4. Error Shape

Every error response, regardless of layer, is normalized by a global
exception filter to:

```json
{
  "statusCode": 422,
  "error": "VALIDATION_ERROR",
  "message": "quantity must be greater than 0",
  "correlationId": "b3f1...",
  "details": [{ "field": "items[2].quantity", "issue": "must be > 0" }]
}
```

`correlationId` is attached to every request (generated at the edge,
propagated through logs and the audit entry) so a user-reported bug can
be traced through logs without guessing at timestamps.

## 5. Cross-Cutting Concerns

| Concern | Mechanism |
|---|---|
| Audit logging | Global `AuditInterceptor` on all mutating verbs (POST/PATCH/DELETE); writes actor, before/after diff, and `correlationId` to `audit_logs` (Phase 2) |
| Rate limiting | NestJS Throttler, Redis-backed store so limits hold across multiple API instances; stricter limits on `/auth/*` |
| Input validation | DTO classes validated at the controller boundary (`class-validator` or Zod pipe) — nothing reaches a service with unvalidated shape |
| Idempotency | `Idempotency-Key` header supported on financially sensitive POSTs (`purchase-orders/:id/issue`, `payments`) — a retried request with the same key returns the original result instead of double-processing |
| File uploads | Client requests a presigned URL (`POST /api/v1/documents/upload-url`), uploads directly to S3/MinIO, then confirms (`POST /api/v1/documents`) with the resulting key — the API never proxies file bytes |
| Approval routing | Any module needing approval calls the shared `common/approval` service against `approval_workflows`/`approval_requests` (Phase 2) rather than re-implementing status transitions per module |
| Multi-currency-ready fields | Amount fields are stored as `NUMERIC`, always paired with the company's `base_currency` — no hardcoded currency symbol in the API layer, so display formatting is a frontend concern only |

## 6. Sample Module Endpoint Map (Purchase Orders — representative depth)

```
GET    /api/v1/purchase-orders
POST   /api/v1/purchase-orders
GET    /api/v1/purchase-orders/:id
PATCH  /api/v1/purchase-orders/:id
POST   /api/v1/purchase-orders/:id/submit-for-approval
POST   /api/v1/purchase-orders/:id/approve
POST   /api/v1/purchase-orders/:id/reject
POST   /api/v1/purchase-orders/:id/issue          # emails supplier, flips status to 'issued'
POST   /api/v1/purchase-orders/:id/deliveries      # record a (partial) delivery
GET    /api/v1/purchase-orders/:id/deliveries
```

Every other module follows the same depth pattern — full per-module
endpoint lists are generated as Swagger/OpenAPI output once controllers
exist (Phase 5), not hand-maintained in a doc that will drift.

## 7. GraphQL-Readiness (not built in V1)

Because Services never depend on `Request`/`Response` or any
HTTP-specific type (Controllers own that boundary), a `@nestjs/graphql`
resolver layer can later call the exact same `QuotationsService`,
`PurchaseOrdersService`, etc. that the REST controllers call. Adding
GraphQL later is additive — it is not a prerequisite this phase blocks
on, and it never requires touching the Service/Repository layers.
