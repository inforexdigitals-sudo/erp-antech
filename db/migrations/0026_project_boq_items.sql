-- =====================================================================
-- 0026_project_boq_items.sql
-- Addendum to module 8 (Progress Claims): a project's BOQ only ever came
-- from its originating quotation's line items, so a project created by
-- hand (no quotation) had nothing for a new claim to pre-fill from and
-- every claim meant retyping every line. project_boq_items lets such a
-- project keep its own saved BOQ — entered or imported once — that new
-- claims load automatically. claim_items.project_boq_item_id plays the
-- same role for these lines that quotation_item_id plays for quotation
-- ones: it's what the "already claimed %" running total is keyed on.
-- =====================================================================

CREATE TABLE project_boq_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  unit        TEXT NOT NULL DEFAULT 'unit',
  quantity    NUMERIC(18,4) NOT NULL DEFAULT 1,
  unit_price  NUMERIC(18,4) NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_boq_items_project ON project_boq_items(project_id, sort_order);

ALTER TABLE claim_items
  ADD COLUMN project_boq_item_id UUID REFERENCES project_boq_items(id) ON DELETE SET NULL;
