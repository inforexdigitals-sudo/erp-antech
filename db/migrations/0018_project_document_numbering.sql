-- =====================================================================
-- 0018_project_document_numbering.sql
-- Addendum (added during Phase 5, Quotations module): the original
-- document_numbering_sequences.document_type CHECK list (0001) covered
-- QT-/PO-/VO-/CLM-/INV- per SRS FR-18.5 but not project numbers.
-- Quotation.convertToProject (FR-3.7) needs one to mint project_number
-- from the same shared sequence mechanism rather than a bespoke scheme.
-- This is exactly the cheap-to-extend shape documented in
-- docs/phase-2-database-design/schema-dictionary.md — a CHECK
-- constraint swap, not a type migration that locks the table.
-- =====================================================================

ALTER TABLE document_numbering_sequences
  DROP CONSTRAINT document_numbering_sequences_document_type_check;

ALTER TABLE document_numbering_sequences
  ADD CONSTRAINT document_numbering_sequences_document_type_check
  CHECK (document_type IN
    ('quotation','purchase_request','rfq','purchase_order',
     'material_request','claim','variation_order','invoice',
     'stock_transfer','project'));
