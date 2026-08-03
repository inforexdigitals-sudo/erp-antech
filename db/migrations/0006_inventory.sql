-- =====================================================================
-- 0006_inventory.sql — Module 7: Inventory
-- =====================================================================

CREATE TABLE warehouses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'warehouse' CHECK (type IN ('warehouse','site_store')),
  project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,  -- set when type = site_store
  address     TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_warehouses_company ON warehouses(company_id) WHERE is_active;

ALTER TABLE po_delivery_items
  ADD CONSTRAINT fk_po_delivery_items_warehouse
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL;

CREATE TABLE stock_levels (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id       UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  item_library_id    UUID NOT NULL REFERENCES item_library(id),
  quantity_on_hand   NUMERIC(18,4) NOT NULL DEFAULT 0,
  quantity_reserved  NUMERIC(18,4) NOT NULL DEFAULT 0,
  reorder_point      NUMERIC(18,4) NOT NULL DEFAULT 0,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, item_library_id)
);
CREATE INDEX idx_stock_levels_item ON stock_levels(item_library_id);
CREATE INDEX idx_stock_levels_low_stock ON stock_levels(warehouse_id) WHERE quantity_on_hand <= reorder_point;

-- Append-only stock ledger — the source of truth for every quantity movement.
-- quantity is signed: positive for receipt/return/transfer_in, negative for
-- issue/transfer_out/adjustment-down.
CREATE TABLE stock_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
  item_library_id UUID NOT NULL REFERENCES item_library(id),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN
                    ('receipt','issue','return','transfer_out','transfer_in','adjustment')),
  quantity        NUMERIC(18,4) NOT NULL,
  reference_type  TEXT NOT NULL CHECK (reference_type IN
                   ('po_delivery','material_issue','stock_transfer','stock_adjustment')),
  reference_id    UUID NOT NULL,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  performed_by    UUID NOT NULL REFERENCES users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_transactions_warehouse_item ON stock_transactions(warehouse_id, item_library_id, created_at DESC);
CREATE INDEX idx_stock_transactions_reference ON stock_transactions(reference_type, reference_id);
CREATE INDEX idx_stock_transactions_project ON stock_transactions(project_id);

CREATE TABLE stock_transfers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  transfer_number  TEXT NOT NULL,
  from_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  to_warehouse_id  UUID NOT NULL REFERENCES warehouses(id),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_transit','completed','cancelled')),
  requested_by     UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, transfer_number),
  CHECK (from_warehouse_id <> to_warehouse_id)
);
CREATE INDEX idx_stock_transfers_company_status ON stock_transfers(company_id, status);

CREATE TABLE stock_transfer_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  item_library_id  UUID NOT NULL REFERENCES item_library(id),
  quantity         NUMERIC(18,4) NOT NULL
);
CREATE INDEX idx_stock_transfer_items_transfer ON stock_transfer_items(stock_transfer_id);

CREATE TABLE stock_adjustments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
  item_library_id UUID NOT NULL REFERENCES item_library(id),
  quantity_delta  NUMERIC(18,4) NOT NULL,
  reason          TEXT NOT NULL,
  approved_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_adjustments_warehouse ON stock_adjustments(warehouse_id, item_library_id);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['warehouses','stock_transfers'] LOOP
    EXECUTE format('CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
  END LOOP;
END $$;
