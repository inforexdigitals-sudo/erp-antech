import { Route, Routes } from 'react-router-dom';
import { ComingSoon } from '../components/ComingSoon';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { Verify2faPage } from '../features/auth/pages/Verify2faPage';
import { ClaimDetailPage } from '../features/claims/pages/ClaimDetailPage';
import { ClaimsListPage } from '../features/claims/pages/ClaimsListPage';
import { CreateClaimPage } from '../features/claims/pages/CreateClaimPage';
import { DashboardPage } from '../features/dashboard/pages/DashboardPage';
import { DocumentsPage } from '../features/documents/pages/DocumentsPage';
import { CustomersPage } from '../features/customers/pages/CustomersPage';
import { CreateInvoiceFromClaimPage } from '../features/invoices/pages/CreateInvoiceFromClaimPage';
import { InvoiceDetailPage } from '../features/invoices/pages/InvoiceDetailPage';
import { InvoicesListPage } from '../features/invoices/pages/InvoicesListPage';
import { PayrollPage } from '../features/payroll/pages/PayrollPage';
import { ProcurementPage } from '../features/procurement/pages/ProcurementPage';
import { ProjectCostingPage } from '../features/project-costing/pages/ProjectCostingPage';
import { CreateVariationOrderPage } from '../features/variation-orders/pages/CreateVariationOrderPage';
import { VariationOrderDetailPage } from '../features/variation-orders/pages/VariationOrderDetailPage';
import { VariationOrdersListPage } from '../features/variation-orders/pages/VariationOrdersListPage';
import { ImportProjectPage } from '../features/project-import/pages/ImportProjectPage';
import { CreateProjectPage } from '../features/projects/pages/CreateProjectPage';
import { TimesheetsPage } from '../features/timesheets/pages/TimesheetsPage';
import { ProjectDetailPage } from '../features/projects/pages/ProjectDetailPage';
import { ProjectsListPage } from '../features/projects/pages/ProjectsListPage';
import { CreateQuotationPage } from '../features/quotations/pages/CreateQuotationPage';
import { QuotationDetailPage } from '../features/quotations/pages/QuotationDetailPage';
import { QuotationsListPage } from '../features/quotations/pages/QuotationsListPage';
import { SettingsPage } from '../features/settings/pages/SettingsPage';
import { AppShell } from '../layouts/AppShell';
import { AuthLayout } from '../layouts/AuthLayout';
import { NAV_GROUPS } from '../layouts/nav-config';
import { ProtectedRoute, PublicOnlyRoute } from './ProtectedRoute';

/** Nav item paths with a real feature module built — excluded from the ComingSoon fallback below. Grows as each batch lands; see apps/web/README.md. */
const BUILT_PATHS = new Set(['/', '/crm', '/quotations', '/projects', '/procurement', '/claims', '/variation-orders', '/costing', '/invoices', '/timesheets', '/payroll', '/documents', '/settings']);

const comingSoonRoutes = NAV_GROUPS.flatMap((g) => g.items).filter((item) => !BUILT_PATHS.has(item.path));

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify-2fa" element={<Verify2faPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />

          <Route path="/crm" element={<CustomersPage />} />

          <Route path="/quotations" element={<QuotationsListPage />} />
          <Route path="/quotations/new" element={<CreateQuotationPage />} />
          <Route path="/quotations/:id" element={<QuotationDetailPage />} />

          <Route path="/projects" element={<ProjectsListPage />} />
          <Route path="/projects/new" element={<CreateProjectPage />} />
          <Route path="/projects/import" element={<ImportProjectPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />

          <Route path="/procurement" element={<ProcurementPage />} />

          <Route path="/claims" element={<ClaimsListPage />} />
          <Route path="/claims/new" element={<CreateClaimPage />} />
          <Route path="/claims/:id" element={<ClaimDetailPage />} />

          <Route path="/variation-orders" element={<VariationOrdersListPage />} />
          <Route path="/variation-orders/new" element={<CreateVariationOrderPage />} />
          <Route path="/variation-orders/:id" element={<VariationOrderDetailPage />} />

          <Route path="/costing" element={<ProjectCostingPage />} />

          <Route path="/invoices" element={<InvoicesListPage />} />
          <Route path="/invoices/new-from-claim/:claimId" element={<CreateInvoiceFromClaimPage />} />
          <Route path="/invoices/:id" element={<InvoiceDetailPage />} />

          <Route path="/timesheets" element={<TimesheetsPage />} />

          <Route path="/payroll" element={<PayrollPage />} />

          <Route path="/documents" element={<DocumentsPage />} />

          <Route path="/settings" element={<SettingsPage />} />

          {comingSoonRoutes.map((item) => (
            <Route key={item.path} path={item.path} element={<ComingSoon title={item.label} />} />
          ))}
        </Route>
      </Route>

      <Route path="*" element={<ComingSoon title="Page not found" />} />
    </Routes>
  );
}
