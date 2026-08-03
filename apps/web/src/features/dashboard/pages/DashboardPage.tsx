import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { EmptyNote, ErrorNote, Spinner } from '../../../components/ui/Feedback';
import { KpiCard } from '../../../components/ui/KpiCard';
import { Pill, type PillTone } from '../../../components/ui/Pill';
import { DataTable, Td, Th, TableWrap, Tr } from '../../../components/ui/Table';
import { ApiError } from '../../../lib/api-client';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { useAuthStore } from '../../../stores/auth-store';
import {
  useActivity,
  useAttendance,
  useCashFlow,
  useCostingRollup,
  useMyPendingApprovals,
  useOpenProcurement,
  useOutstandingClaims,
  useOutstandingQuotations,
  usePortfolio,
} from '../hooks';
import type { PortfolioBucket } from '../api';

const BUCKET_LABEL: Record<PortfolioBucket, string> = {
  on_track: 'On track',
  at_risk: 'At risk',
  delayed: 'Delayed',
  closed: 'Closed',
};

const BUCKET_TONE: Record<PortfolioBucket, PillTone> = {
  on_track: 'success',
  at_risk: 'warning',
  delayed: 'critical',
  closed: 'neutral',
};

/**
 * Every `action` value `AuditService.record()` is ever called with,
 * across every module — not derived by suffixing (`action + 'd'`),
 * which reads fine for "create" → "created" but breaks for anything
 * that isn't a regular `-d`-suffixed past tense: "login" → "logind",
 * "certify" → "certifyd", "send" → "sendd" were all wrong before this.
 * Falls back to the raw code (with underscores turned to spaces)
 * rather than guessing at a new action added later without updating
 * this map.
 */
const ACTION_LABEL: Record<string, string> = {
  create: 'created',
  update: 'updated',
  delete: 'deleted',
  cancel: 'cancelled',
  certify: 'certified',
  void: 'voided',
  issue: 'issued',
  send: 'sent',
  login: 'logged in',
  login_failed: 'failed to log in',
  clock_in: 'clocked in on',
  clock_out: 'clocked out on',
  submit_for_approval: 'submitted for approval',
  client_sign_off: 'recorded client sign-off on',
  request_client_sign_off: 'requested client sign-off on',
  convert_to_project: 'converted to a project',
  record_delivery: 'recorded a delivery on',
  record_payment: 'recorded a payment on',
  record_response: 'recorded a response on',
  select_response: 'selected a response on',
  add_recipients: 'added recipients to',
  add_version: 'added a version to',
  generate_export: 'generated an export for',
  grant_permission: 'granted a permission on',
  revoke_permission: 'revoked a permission on',
};

function describeAction(action: string): string {
  return ACTION_LABEL[action] ?? action.replace(/_/g, ' ');
}

function SectionState({ isLoading, error }: { isLoading: boolean; error: unknown }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center px-4 py-8">
        <Spinner />
      </div>
    );
  }
  if (error) {
    return <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load this section.'}</ErrorNote>;
  }
  return null;
}

export function DashboardPage() {
  const profile = useAuthStore((s) => s.profile);
  const portfolio = usePortfolio();
  const quotations = useOutstandingQuotations();
  const procurement = useOpenProcurement();
  const claims = useOutstandingClaims();
  const approvals = useMyPendingApprovals();
  const costing = useCostingRollup();
  const cashFlow = useCashFlow();
  const attendance = useAttendance();
  const activity = useActivity();

  const activeProjects = portfolio.data
    ? portfolio.data.buckets.on_track + portfolio.data.buckets.at_risk + portfolio.data.buckets.delayed
    : undefined;

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-2">Overview</div>
          <h1 className="text-xl">{profile ? `Good to see you, ${profile.fullName.split(' ')[0]}` : 'Dashboard'}</h1>
          <div className="mt-[3px] text-[13px] text-muted">
            {approvals.data ? `${approvals.data.length} approval${approvals.data.length === 1 ? '' : 's'} waiting on you` : ' '}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active Projects" value={activeProjects ?? <Spinner />} />
        <KpiCard
          label="Outstanding Quotations"
          value={quotations.data ? formatCurrency(quotations.data.totalValue) : <Spinner />}
          delta={quotations.data ? `${quotations.data.count} quotation${quotations.data.count === 1 ? '' : 's'}` : undefined}
        />
        <KpiCard
          label="Open Purchase Orders"
          value={procurement.data ? procurement.data.reduce((sum, r) => sum + r.count, 0) : <Spinner />}
          delta={
            procurement.data
              ? formatCurrency(procurement.data.reduce((sum, r) => sum + r.totalValue, 0)) + ' committed'
              : undefined
          }
        />
        <KpiCard
          label="Outstanding Claims"
          value={claims.data ? formatCurrency(claims.data.totalValue) : <Spinner />}
          delta={claims.data ? `${claims.data.count} claim${claims.data.count === 1 ? '' : 's'}` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Project Portfolio</CardTitle>
          </CardHeader>
          <SectionState isLoading={portfolio.isLoading} error={portfolio.error} />
          {portfolio.data && (
            <TableWrap>
              <DataTable>
                <thead>
                  <tr>
                    <Th>Project</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.data.projects.length === 0 && (
                    <tr>
                      <td colSpan={2}>
                        <EmptyNote>No projects yet.</EmptyNote>
                      </td>
                    </tr>
                  )}
                  {portfolio.data.projects.map((p) => (
                    <Tr key={p.id}>
                      <Td>
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-xs text-muted">{p.projectNumber}</div>
                      </Td>
                      <Td>
                        <Pill tone={BUCKET_TONE[p.bucket]}>{BUCKET_LABEL[p.bucket]}</Pill>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </DataTable>
            </TableWrap>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My Pending Approvals</CardTitle>
          </CardHeader>
          <SectionState isLoading={approvals.isLoading} error={approvals.error} />
          {approvals.data && (
            <div className="flex flex-col">
              {approvals.data.length === 0 && <EmptyNote>Nothing waiting on you right now.</EmptyNote>}
              {approvals.data.map((a) => (
                <div key={a.approvalRequestId} className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5 text-[13px] last:border-0">
                  <div className="min-w-0">
                    <div className="truncate font-medium capitalize">{a.entityType.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-muted">{formatDate(a.createdAt)}</div>
                  </div>
                  <Pill tone="info">Pending</Pill>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Open Procurement</CardTitle>
          </CardHeader>
          <SectionState isLoading={procurement.isLoading} error={procurement.error} />
          {procurement.data && (
            <div className="flex flex-col">
              {procurement.data.length === 0 && <EmptyNote>No open purchase orders.</EmptyNote>}
              {procurement.data.map((row) => (
                <div key={row.status} className="flex items-center justify-between border-b border-line px-4 py-2.5 text-[13px] last:border-0">
                  <span className="capitalize">{row.status.replace(/_/g, ' ')}</span>
                  <span className="num">
                    {row.count} · {formatCurrency(row.totalValue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cash Flow (approx.)</CardTitle>
          </CardHeader>
          <SectionState isLoading={cashFlow.isLoading} error={cashFlow.error} />
          {cashFlow.data && (
            <CardContent className="flex flex-col gap-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-muted">Inflow (unpaid invoices)</span>
                <span className="num font-medium text-success">{formatCurrency(cashFlow.data.inflow)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Outflow (open POs)</span>
                <span className="num font-medium text-critical">
                  {formatCurrency(cashFlow.data.outflowBreakdown.purchaseOrders)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Outflow (latest payroll)</span>
                <span className="num font-medium text-critical">
                  {formatCurrency(cashFlow.data.outflowBreakdown.payroll)}
                </span>
              </div>
              <div className="mt-1 flex justify-between border-t border-line pt-2 font-semibold">
                <span>Net</span>
                <span className="num">{formatCurrency(cashFlow.data.net)}</span>
              </div>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today's Attendance</CardTitle>
          </CardHeader>
          <SectionState isLoading={attendance.isLoading} error={attendance.error} />
          {attendance.data && (
            <CardContent className="flex flex-col items-center justify-center gap-1 py-6">
              <span className="num text-3xl font-bold">{attendance.data.clockedInCount}</span>
              <span className="text-xs text-muted">clocked in today</span>
            </CardContent>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company-wide Costing</CardTitle>
        </CardHeader>
        <SectionState isLoading={costing.isLoading} error={costing.error} />
        {costing.data && !costing.data.hasBudget && <EmptyNote>No project budgets have been set yet.</EmptyNote>}
        {costing.data && costing.data.hasBudget && (
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <Th>Category</Th>
                  <Th numeric>Committed</Th>
                  <Th numeric>Actual</Th>
                  <Th numeric>Forecast</Th>
                </tr>
              </thead>
              <tbody>
                {costing.data.byCategory.map((row) => (
                  <Tr key={row.costCategory}>
                    <Td className="capitalize">{row.costCategory}</Td>
                    <Td numeric>{formatCurrency(row.committed)}</Td>
                    <Td numeric>{formatCurrency(row.actual)}</Td>
                    <Td numeric>{formatCurrency(row.forecast)}</Td>
                  </Tr>
                ))}
                <Tr className="font-semibold">
                  <Td>Total (budget {formatCurrency(costing.data.totals.budgeted)})</Td>
                  <Td numeric>{formatCurrency(costing.data.totals.committed)}</Td>
                  <Td numeric>{formatCurrency(costing.data.totals.actual)}</Td>
                  <Td numeric>{formatCurrency(costing.data.totals.forecast)}</Td>
                </Tr>
              </tbody>
            </DataTable>
          </TableWrap>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <SectionState isLoading={activity.isLoading} error={activity.error} />
        {activity.data && (
          <div className="flex flex-col">
            {activity.data.length === 0 && <EmptyNote>No activity recorded yet.</EmptyNote>}
            {activity.data.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5 text-[13px] last:border-0">
                <span>
                  <span className="font-medium">{entry.actorUser?.fullName ?? 'System'}</span>{' '}
                  <span className="text-muted">{describeAction(entry.action)}</span>
                  {/* "logged in" already names what happened — appending "User" would be redundant, unlike "created Quotation". */}
                  {entry.action !== 'login' && entry.action !== 'login_failed' && (
                    <>
                      {' '}
                      <span className="capitalize">{entry.entityType.replace(/_/g, ' ')}</span>
                    </>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted">{formatDate(entry.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
