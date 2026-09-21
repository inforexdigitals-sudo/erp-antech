-- =====================================================================
-- 0025_variation_order_export_permission.sql
-- Addendum: adds PDF export for Variation Orders (Quotations, Purchase
-- Orders, Invoices and Payment Certificates already had it — Variation
-- Orders were the one document type in module 9 that never got a PDF
-- export path, same class of gap as 0020's purchase_order.export).
-- =====================================================================

INSERT INTO permissions (module, action, code, description) VALUES
  ('variation_order', 'export', 'variation_order.export', 'Export variation order PDF')
ON CONFLICT (code) DO NOTHING;
