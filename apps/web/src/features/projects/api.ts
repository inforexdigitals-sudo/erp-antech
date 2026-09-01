import { api, toQueryString, type PaginatedResult } from '../../lib/api-client';

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'closed' | 'cancelled';
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'delayed';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked';
export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface Project {
  id: string;
  projectNumber: string;
  name: string;
  quotationId: string | null;
  status: ProjectStatus;
  startDate: string | null;
  plannedEndDate: string | null;
  actualEndDate: string | null;
  contractValue: string;
  address: string | null;
  description: string | null;
  customer: { id: string; name: string };
  projectManager: { id: string; fullName: string } | null;
  teamMembers: Array<{ id: string; userId: string; roleOnProject: string | null; user: { id: string; fullName: string; jobTitle: string | null } }>;
  milestones: Array<{ id: string; name: string; dueDate: string | null; status: MilestoneStatus; sortOrder: number }>;
  budget: { id: string; totalBudget: string } | null;
}

export interface ProjectTask {
  id: string;
  milestoneId: string | null;
  name: string;
  description: string | null;
  assigneeUserId: string | null;
  status: TaskStatus;
  dueDate: string | null;
}

export interface SiteReport {
  id: string;
  reportDate: string;
  submittedBy: string;
  weather: string | null;
  manpowerCount: number | null;
  progressSummary: string | null;
  createdAt: string;
}

export interface ProjectIssue {
  id: string;
  title: string;
  description: string | null;
  severity: IssueSeverity;
  status: IssueStatus;
  assignedTo: string | null;
  dueDate: string | null;
  resolvedAt: string | null;
}

export interface CreateProjectInput {
  name: string;
  customerId: string;
  projectManagerId?: string;
  startDate?: string;
  plannedEndDate?: string;
  contractValue?: number;
  address?: string;
  description?: string;
}

export interface QueryProjects {
  page?: number;
  pageSize?: number;
  status?: string;
  customerId?: string;
}

export const projectsApi = {
  list: (query: QueryProjects) => api.get<PaginatedResult<Project>>(`/projects${toQueryString(query)}`),
  get: (id: string) => api.get<Project>(`/projects/${id}`),
  create: (input: CreateProjectInput) => api.post<Project>('/projects', input),
  update: (id: string, input: Partial<CreateProjectInput> & { status?: ProjectStatus; actualEndDate?: string }) =>
    api.patch<Project>(`/projects/${id}`, input),
  remove: (id: string) => api.delete<void>(`/projects/${id}`),

  addTeamMember: (id: string, input: { userId: string; roleOnProject?: string }) =>
    api.post(`/projects/${id}/team-members`, input),
  removeTeamMember: (id: string, userId: string) => api.delete(`/projects/${id}/team-members/${userId}`),

  addMilestone: (id: string, input: { name: string; dueDate?: string }) =>
    api.post(`/projects/${id}/milestones`, input),
  updateMilestone: (id: string, milestoneId: string, input: { status?: MilestoneStatus; name?: string; dueDate?: string }) =>
    api.patch(`/projects/${id}/milestones/${milestoneId}`, input),

  listTasks: (id: string) => api.get<ProjectTask[]>(`/projects/${id}/tasks`),
  addTask: (id: string, input: { name: string; milestoneId?: string; description?: string; dueDate?: string }) =>
    api.post<ProjectTask>(`/projects/${id}/tasks`, input),
  updateTask: (id: string, taskId: string, input: { status?: TaskStatus }) =>
    api.patch<ProjectTask>(`/projects/${id}/tasks/${taskId}`, input),

  listSiteReports: (id: string) => api.get<SiteReport[]>(`/projects/${id}/site-reports`),
  addSiteReport: (id: string, input: { reportDate: string; weather?: string; manpowerCount?: number; progressSummary?: string }) =>
    api.post<SiteReport>(`/projects/${id}/site-reports`, input),

  listIssues: (id: string) => api.get<ProjectIssue[]>(`/projects/${id}/issues`),
  addIssue: (id: string, input: { title: string; description?: string; severity?: IssueSeverity; dueDate?: string }) =>
    api.post<ProjectIssue>(`/projects/${id}/issues`, input),
  updateIssue: (id: string, issueId: string, input: { status?: IssueStatus }) =>
    api.patch<ProjectIssue>(`/projects/${id}/issues/${issueId}`, input),
};
