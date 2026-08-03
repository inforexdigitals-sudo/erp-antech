-- =====================================================================
-- 0010_timesheets_and_payroll.sql — Modules 11 (Timesheets) & 12 (Payroll)
-- =====================================================================

CREATE TABLE timesheets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id),
  work_date      DATE NOT NULL,
  clock_in       TIMESTAMPTZ,
  clock_out      TIMESTAMPTZ,
  clock_in_lat   NUMERIC(9,6),
  clock_in_lng   NUMERIC(9,6),
  clock_out_lat  NUMERIC(9,6),
  clock_out_lng  NUMERIC(9,6),
  total_hours    NUMERIC(5,2) NOT NULL DEFAULT 0,
  overtime_hours NUMERIC(5,2) NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected')),
  approved_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, work_date)
);
CREATE INDEX idx_timesheets_company_status ON timesheets(company_id, status);
CREATE INDEX idx_timesheets_user_date ON timesheets(user_id, work_date DESC);

CREATE TABLE timesheet_allocations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id  UUID NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
  project_id    UUID NOT NULL REFERENCES projects(id),
  hours         NUMERIC(5,2) NOT NULL,
  cost_category TEXT NOT NULL DEFAULT 'labour' CHECK (cost_category = 'labour')
);
CREATE INDEX idx_timesheet_allocations_timesheet ON timesheet_allocations(timesheet_id);
CREATE INDEX idx_timesheet_allocations_project ON timesheet_allocations(project_id);

CREATE TABLE leave_types (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  is_paid                BOOLEAN NOT NULL DEFAULT TRUE,
  annual_entitlement_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  UNIQUE (company_id, name)
);

CREATE TABLE leave_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id),
  leave_type_id UUID NOT NULL REFERENCES leave_types(id),
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  days          NUMERIC(5,2) NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX idx_leave_requests_user ON leave_requests(user_id, status);
CREATE INDEX idx_leave_requests_company_status ON leave_requests(company_id, status);

CREATE TABLE leave_balances (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type_id  UUID NOT NULL REFERENCES leave_types(id),
  year           SMALLINT NOT NULL,
  entitled_days  NUMERIC(5,2) NOT NULL DEFAULT 0,
  used_days      NUMERIC(5,2) NOT NULL DEFAULT 0,
  adjusted_days  NUMERIC(5,2) NOT NULL DEFAULT 0,
  UNIQUE (user_id, leave_type_id, year)
);

-- ---------------------------------------------------------------------
-- Payroll (derives from approved timesheets/leave — no duplicate entry)
-- ---------------------------------------------------------------------
CREATE TABLE payroll_periods (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','processing','exported','closed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, period_start, period_end)
);

CREATE TABLE payroll_exports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  exported_by       UUID NOT NULL REFERENCES users(id),
  exported_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  file_reference    TEXT,
  format            TEXT NOT NULL DEFAULT 'csv' CHECK (format IN ('csv','api'))
);
CREATE INDEX idx_payroll_exports_period ON payroll_exports(payroll_period_id);

CREATE TABLE payroll_export_lines (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_export_id               UUID NOT NULL REFERENCES payroll_exports(id) ON DELETE CASCADE,
  user_id                         UUID NOT NULL REFERENCES users(id),
  regular_hours                   NUMERIC(7,2) NOT NULL DEFAULT 0,
  overtime_hours                  NUMERIC(7,2) NOT NULL DEFAULT 0,
  allowances                      NUMERIC(18,2) NOT NULL DEFAULT 0,
  deductions                      NUMERIC(18,2) NOT NULL DEFAULT 0,
  statutory_employee_contribution NUMERIC(18,2) NOT NULL DEFAULT 0,
  statutory_employer_contribution NUMERIC(18,2) NOT NULL DEFAULT 0,
  net_pay                         NUMERIC(18,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_payroll_export_lines_export ON payroll_export_lines(payroll_export_id);
CREATE INDEX idx_payroll_export_lines_user ON payroll_export_lines(user_id);

CREATE TABLE statutory_contribution_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  country_code     CHAR(2) NOT NULL,
  scheme           TEXT NOT NULL CHECK (scheme IN ('CPF','EPF','SOCSO')),
  age_band         TEXT,
  employee_rate    NUMERIC(5,2) NOT NULL,
  employer_rate    NUMERIC(5,2) NOT NULL,
  salary_ceiling   NUMERIC(18,2),
  effective_from   DATE NOT NULL,
  effective_to     DATE
);
CREATE INDEX idx_statutory_rules_company_scheme ON statutory_contribution_rules(company_id, scheme, effective_from);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['timesheets','leave_requests'] LOOP
    EXECUTE format('CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
  END LOOP;
END $$;
