import { FormEvent, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { EmptyNote, ErrorNote, Spinner } from '../../../components/ui/Feedback';
import { Field, Input } from '../../../components/ui/Input';
import { Select, Textarea } from '../../../components/ui/Select';
import { StatusPill } from '../../../components/ui/StatusPill';
import { Tabs } from '../../../components/ui/Tabs';
import { DataTable, Td, Th, TableWrap, Tr } from '../../../components/ui/Table';
import { ApiError } from '../../../lib/api-client';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { ProjectCostingPanel } from '../../project-costing/ProjectCostingPanel';
import { usePickerUsers } from '../../shared/hooks';
import { useProject, useProjectIssues, useProjectMutations, useProjectSiteReports, useProjectTasks } from '../hooks';
import type { IssueSeverity, IssueStatus, MilestoneStatus, TaskStatus } from '../api';

const MILESTONE_STATUSES: MilestoneStatus[] = ['pending', 'in_progress', 'completed', 'delayed'];
const TASK_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done', 'blocked'];
const ISSUE_STATUSES: IssueStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
const ISSUE_SEVERITIES: IssueSeverity[] = ['low', 'medium', 'high', 'critical'];

function OverviewTab({ project }: { project: NonNullable<ReturnType<typeof useProject>['data']> }) {
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2 text-[13px]">
          <div className="flex justify-between"><span className="text-muted">Customer</span><span>{project.customer.name}</span></div>
          <div className="flex justify-between"><span className="text-muted">Project Manager</span><span>{project.projectManager?.fullName ?? '—'}</span></div>
          <div className="flex justify-between"><span className="text-muted">Contract Value</span><span className="num">{formatCurrency(project.contractValue)}</span></div>
          <div className="flex justify-between"><span className="text-muted">Start Date</span><span>{formatDate(project.startDate)}</span></div>
          <div className="flex justify-between"><span className="text-muted">Planned End</span><span>{formatDate(project.plannedEndDate)}</span></div>
          <div className="flex justify-between"><span className="text-muted">Address</span><span>{project.address ?? '—'}</span></div>
          <div className="flex justify-between"><span className="text-muted">Budget</span><span>{project.budget ? formatCurrency(project.budget.totalBudget) : 'Not set — see Project Costing'}</span></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Team</CardTitle></CardHeader>
        {project.teamMembers.length === 0 ? (
          <EmptyNote>No team members assigned yet.</EmptyNote>
        ) : (
          <div className="flex flex-col">
            {project.teamMembers.map((tm) => (
              <div key={tm.id} className="flex justify-between border-b border-line px-4 py-2.5 text-[13px] last:border-0">
                <span className="font-medium">{tm.user.fullName}</span>
                <span className="text-muted">{tm.roleOnProject ?? tm.user.jobTitle ?? '—'}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function TeamTab({ projectId, project }: { projectId: string; project: NonNullable<ReturnType<typeof useProject>['data']> }) {
  const users = usePickerUsers();
  const { addTeamMember, removeTeamMember } = useProjectMutations(projectId);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('');

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;
    await addTeamMember.mutateAsync({ userId, roleOnProject: role || undefined });
    setUserId('');
    setRole('');
  }

  return (
    <Card>
      <CardHeader><CardTitle>Team Members</CardTitle></CardHeader>
      {project.teamMembers.length === 0 && <EmptyNote>No team members yet.</EmptyNote>}
      <div className="flex flex-col">
        {project.teamMembers.map((tm) => (
          <div key={tm.id} className="flex items-center justify-between border-b border-line px-4 py-2.5 text-[13px] last:border-0">
            <div>
              <div className="font-medium">{tm.user.fullName}</div>
              <div className="text-xs text-muted">{tm.roleOnProject ?? tm.user.jobTitle ?? '—'}</div>
            </div>
            <Button size="sm" onClick={() => removeTeamMember.mutate(tm.userId)}>Remove</Button>
          </div>
        ))}
      </div>
      <form onSubmit={onAdd} className="flex flex-wrap items-end gap-2.5 border-t border-line p-4">
        <Field label="User" htmlFor="tm-user">
          <Select id="tm-user" value={userId} onChange={(e) => setUserId(e.target.value)} className="min-w-[180px]">
            <option value="">Select…</option>
            {users.data?.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </Select>
        </Field>
        <Field label="Role on Project" htmlFor="tm-role">
          <Input id="tm-role" placeholder="e.g. Site Engineer" value={role} onChange={(e) => setRole(e.target.value)} />
        </Field>
        <Button type="submit" variant="primary" disabled={!userId || addTeamMember.isPending}>Add</Button>
      </form>
    </Card>
  );
}

function MilestonesTab({ projectId, project }: { projectId: string; project: NonNullable<ReturnType<typeof useProject>['data']> }) {
  const { addMilestone, updateMilestoneStatus } = useProjectMutations(projectId);
  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState('');

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!name) return;
    await addMilestone.mutateAsync({ name, dueDate: dueDate || undefined });
    setName('');
    setDueDate('');
  }

  return (
    <Card>
      <CardHeader><CardTitle>Milestones</CardTitle></CardHeader>
      {project.milestones.length === 0 && <EmptyNote>No milestones yet.</EmptyNote>}
      <div className="flex flex-col">
        {project.milestones.map((m) => (
          <div key={m.id} className="flex items-center justify-between border-b border-line px-4 py-2.5 text-[13px] last:border-0">
            <div>
              <div className="font-medium">{m.name}</div>
              <div className="text-xs text-muted">Due {formatDate(m.dueDate)}</div>
            </div>
            <Select
              value={m.status}
              onChange={(e) => updateMilestoneStatus.mutate({ milestoneId: m.id, status: e.target.value as MilestoneStatus })}
              className="w-[140px]"
            >
              {MILESTONE_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </Select>
          </div>
        ))}
      </div>
      <form onSubmit={onAdd} className="flex flex-wrap items-end gap-2.5 border-t border-line p-4">
        <Field label="Milestone Name" htmlFor="ms-name">
          <Input id="ms-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Due Date" htmlFor="ms-due">
          <Input id="ms-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Button type="submit" variant="primary" disabled={!name || addMilestone.isPending}>Add</Button>
      </form>
    </Card>
  );
}

function TasksTab({ projectId }: { projectId: string }) {
  const { data: tasks, isLoading } = useProjectTasks(projectId);
  const { addTask, updateTaskStatus } = useProjectMutations(projectId);
  const [name, setName] = useState('');

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!name) return;
    await addTask.mutateAsync({ name });
    setName('');
  }

  return (
    <Card>
      <CardHeader><CardTitle>Tasks</CardTitle></CardHeader>
      {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
      {tasks && tasks.length === 0 && <EmptyNote>No tasks yet.</EmptyNote>}
      {tasks && (
        <div className="flex flex-col">
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between border-b border-line px-4 py-2.5 text-[13px] last:border-0">
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-muted">Due {formatDate(t.dueDate)}</div>
              </div>
              <Select
                value={t.status}
                onChange={(e) => updateTaskStatus.mutate({ taskId: t.id, status: e.target.value as TaskStatus })}
                className="w-[140px]"
              >
                {TASK_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </Select>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={onAdd} className="flex flex-wrap items-end gap-2.5 border-t border-line p-4">
        <Field label="Task Name" htmlFor="task-name">
          <Input id="task-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Button type="submit" variant="primary" disabled={!name || addTask.isPending}>Add</Button>
      </form>
    </Card>
  );
}

function SiteReportsTab({ projectId }: { projectId: string }) {
  const { data: reports, isLoading } = useProjectSiteReports(projectId);
  const { addSiteReport } = useProjectMutations(projectId);
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [weather, setWeather] = useState('');
  const [manpowerCount, setManpowerCount] = useState(0);
  const [progressSummary, setProgressSummary] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await addSiteReport.mutateAsync({ reportDate, weather: weather || undefined, manpowerCount, progressSummary: progressSummary || undefined });
      setWeather('');
      setProgressSummary('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit this report.');
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Site Reports</CardTitle></CardHeader>
      {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
      {reports && reports.length === 0 && <EmptyNote>No site reports yet.</EmptyNote>}
      {reports && (
        <TableWrap>
          <DataTable>
            <thead><tr><Th>Date</Th><Th>Weather</Th><Th numeric>Manpower</Th><Th>Summary</Th></tr></thead>
            <tbody>
              {reports.map((r) => (
                <Tr key={r.id}>
                  <Td>{formatDate(r.reportDate)}</Td>
                  <Td>{r.weather ?? '—'}</Td>
                  <Td numeric>{r.manpowerCount ?? '—'}</Td>
                  <Td>{r.progressSummary ?? '—'}</Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        </TableWrap>
      )}
      <form onSubmit={onAdd} className="flex flex-col gap-2.5 border-t border-line p-4">
        <div className="flex flex-wrap items-end gap-2.5">
          <Field label="Date" htmlFor="sr-date">
            <Input id="sr-date" type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
          </Field>
          <Field label="Weather" htmlFor="sr-weather">
            <Input id="sr-weather" value={weather} onChange={(e) => setWeather(e.target.value)} />
          </Field>
          <Field label="Manpower" htmlFor="sr-manpower">
            <Input id="sr-manpower" type="number" min={0} value={manpowerCount} onChange={(e) => setManpowerCount(Number(e.target.value))} />
          </Field>
        </div>
        <Field label="Progress Summary" htmlFor="sr-summary">
          <Textarea id="sr-summary" rows={2} value={progressSummary} onChange={(e) => setProgressSummary(e.target.value)} />
        </Field>
        {error && <p className="text-[12.5px] text-critical">{error}</p>}
        <Button type="submit" variant="primary" disabled={addSiteReport.isPending} className="self-end">Submit Report</Button>
      </form>
    </Card>
  );
}

function IssuesTab({ projectId }: { projectId: string }) {
  const { data: issues, isLoading } = useProjectIssues(projectId);
  const { addIssue, updateIssueStatus } = useProjectMutations(projectId);
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<IssueSeverity>('medium');

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!title) return;
    await addIssue.mutateAsync({ title, severity });
    setTitle('');
  }

  return (
    <Card>
      <CardHeader><CardTitle>Issues</CardTitle></CardHeader>
      {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
      {issues && issues.length === 0 && <EmptyNote>No issues logged.</EmptyNote>}
      {issues && (
        <div className="flex flex-col">
          {issues.map((i) => (
            <div key={i.id} className="flex items-center justify-between border-b border-line px-4 py-2.5 text-[13px] last:border-0">
              <div>
                <div className="font-medium">{i.title}</div>
                <div className="text-xs text-muted capitalize">{i.severity} severity</div>
              </div>
              <Select
                value={i.status}
                onChange={(e) => updateIssueStatus.mutate({ issueId: i.id, status: e.target.value as IssueStatus })}
                className="w-[140px]"
              >
                {ISSUE_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </Select>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={onAdd} className="flex flex-wrap items-end gap-2.5 border-t border-line p-4">
        <Field label="Issue Title" htmlFor="issue-title">
          <Input id="issue-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Severity" htmlFor="issue-sev">
          <Select id="issue-sev" value={severity} onChange={(e) => setSeverity(e.target.value as IssueSeverity)}>
            {ISSUE_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Button type="submit" variant="primary" disabled={!title || addIssue.isPending}>Log Issue</Button>
      </form>
    </Card>
  );
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading, error } = useProject(id);
  const [tab, setTab] = useState('overview');

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error) return <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load this project.'}</ErrorNote>;
  if (!project || !id) return null;

  return (
    <div>
      <PageHeader
        eyebrow="Delivery"
        title={<span className="flex items-center gap-2.5">{project.name}<StatusPill domain="project" status={project.status} /></span>}
        subtitle={`${project.projectNumber} · ${project.customer.name}`}
      />
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'team', label: 'Team' },
          { key: 'milestones', label: 'Milestones' },
          { key: 'tasks', label: 'Tasks' },
          { key: 'site-reports', label: 'Site Reports' },
          { key: 'issues', label: 'Issues' },
          { key: 'costing', label: 'Costing' },
        ]}
      />
      {tab === 'overview' && <OverviewTab project={project} />}
      {tab === 'team' && <TeamTab projectId={id} project={project} />}
      {tab === 'milestones' && <MilestonesTab projectId={id} project={project} />}
      {tab === 'tasks' && <TasksTab projectId={id} />}
      {tab === 'site-reports' && <SiteReportsTab projectId={id} />}
      {tab === 'issues' && <IssuesTab projectId={id} />}
      {tab === 'costing' && <ProjectCostingPanel projectId={id} hasQuotation={!!project.quotationId} />}
    </div>
  );
}
