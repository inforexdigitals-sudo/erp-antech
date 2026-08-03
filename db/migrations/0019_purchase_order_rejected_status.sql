-- =====================================================================
-- 0019_purchase_order_rejected_status.sql
-- Addendum (found by the TypeScript compiler during Phase 5 review):
-- purchase_orders.status (0005) never included 'rejected' — an
-- oversight from the original Phase 2 pass. purchase-orders.service.ts
-- assumes a rejected approval decision maps to a 'rejected' PO status
-- (mirroring Quotations, where a rejected item can be revised and
-- resubmitted — see REVISABLE_STATUSES). Without this, rejecting a PO
-- would have hit a live CHECK constraint violation, not just a type
-- error; the compiler caught it first only because it happened to run
-- before the database did.
-- =====================================================================

ALTER TABLE purchase_orders
  DROP CONSTRAINT purchase_orders_status_check;

ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_status_check
  CHECK (status IN
    ('draft','pending_approval','approved','rejected','issued',
     'partially_received','received','closed','cancelled'));
