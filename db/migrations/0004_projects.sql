-- =====================================================================
-- 0004_projects.sql — Module 4: Project Management
-- =====================================================================

CREATE TABLE projects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_number    TEXT NOT NULL,
  name              TEXT NOT NULL,
  customer_id       UUID NOT NULL REFERENCES customers(id),
  quotation_id      UUID REFERENCES quotations(id) ON DELETE SET NULL,
  project_manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'planning' CHECK (status IN
                     ('planning','active','on_hold','completed','closed','cancelled')),
  start_date        DATE,
  planned_end_date  DATE,
  actual_end_date   DATE,
  contract_value    NUMERIC(18,2) NOT NULL DEFAULT 0,
  address           TEXT,
  description       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, project_number)
);
CREATE INDEX idx_projects_company_status ON projects(company_id, status);
CREATE INDEX idx_projects_customer ON projects(customer_id);
CREATE INDEX idx_projects_name_trgm ON projects USING GIN (name gin_trgm_ops);

CREATE TABLE project_team_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_on_project TEXT,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
CREATE INDEX idx_project_team_members_project ON project_team_members(project_id);
CREATE INDEX idx_project_team_members_user ON project_team_members(user_id);

CREATE TABLE project_milestones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  due_date    DATE,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','delayed')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_milestones_project ON project_milestones(project_id, due_date);

CREATE TABLE project_tasks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id   UUID REFERENCES project_milestones(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  description    TEXT,
  assignee_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done','blocked')),
  due_date       DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_tasks_project ON project_tasks(project_id, status);
CREATE INDEX idx_project_tasks_assignee ON project_tasks(assignee_user_id);

CREATE TABLE site_reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  report_date      DATE NOT NULL,
  submitted_by     UUID NOT NULL REFERENCES users(id),
  weather          TEXT,
  manpower_count   INTEGER,
  progress_summary TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, report_date, submitted_by)
);
CREATE INDEX idx_site_reports_project_date ON site_reports(project_id, report_date DESC);

CREATE TABLE project_issues (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  severity     TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  reported_by  UUID NOT NULL REFERENCES users(id),
  assigned_to  UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date     DATE,
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_issues_project_status ON project_issues(project_id, status);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['projects','project_milestones','project_tasks','site_reports','project_issues'] LOOP
    EXECUTE format('CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
  END LOOP;
END $$;
