import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi, QueryProjects } from './api';
import type {
  CreateProjectInput,
  IssueSeverity,
  IssueStatus,
  MilestoneStatus,
  ProjectStatus,
  TaskStatus,
} from './api';

export function useProjects(query: QueryProjects) {
  return useQuery({ queryKey: ['projects', query], queryFn: () => projectsApi.list(query) });
}

export function useProject(id: string | undefined) {
  return useQuery({ queryKey: ['projects', id], queryFn: () => projectsApi.get(id!), enabled: !!id });
}

export function useProjectTasks(id: string | undefined) {
  return useQuery({ queryKey: ['projects', id, 'tasks'], queryFn: () => projectsApi.listTasks(id!), enabled: !!id });
}

export function useProjectSiteReports(id: string | undefined) {
  return useQuery({ queryKey: ['projects', id, 'site-reports'], queryFn: () => projectsApi.listSiteReports(id!), enabled: !!id });
}

export function useProjectIssues(id: string | undefined) {
  return useQuery({ queryKey: ['projects', id, 'issues'], queryFn: () => projectsApi.listIssues(id!), enabled: !!id });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => projectsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useProjectMutations(id: string) {
  const qc = useQueryClient();
  const invalidateProject = () => qc.invalidateQueries({ queryKey: ['projects', id] });
  return {
    update: useMutation({
      mutationFn: (input: Partial<CreateProjectInput> & { status?: ProjectStatus }) => projectsApi.update(id, input),
      onSuccess: invalidateProject,
    }),
    remove: useMutation({
      mutationFn: () => projectsApi.remove(id),
      onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
    }),
    addTeamMember: useMutation({
      mutationFn: (input: { userId: string; roleOnProject?: string }) => projectsApi.addTeamMember(id, input),
      onSuccess: invalidateProject,
    }),
    removeTeamMember: useMutation({
      mutationFn: (userId: string) => projectsApi.removeTeamMember(id, userId),
      onSuccess: invalidateProject,
    }),
    addMilestone: useMutation({
      mutationFn: (input: { name: string; dueDate?: string }) => projectsApi.addMilestone(id, input),
      onSuccess: invalidateProject,
    }),
    updateMilestoneStatus: useMutation({
      mutationFn: ({ milestoneId, status }: { milestoneId: string; status: MilestoneStatus }) =>
        projectsApi.updateMilestone(id, milestoneId, { status }),
      onSuccess: invalidateProject,
    }),
    addTask: useMutation({
      mutationFn: (input: { name: string; milestoneId?: string; description?: string; dueDate?: string }) =>
        projectsApi.addTask(id, input),
      onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', id, 'tasks'] }),
    }),
    updateTaskStatus: useMutation({
      mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) => projectsApi.updateTask(id, taskId, { status }),
      onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', id, 'tasks'] }),
    }),
    addSiteReport: useMutation({
      mutationFn: (input: { reportDate: string; weather?: string; manpowerCount?: number; progressSummary?: string }) =>
        projectsApi.addSiteReport(id, input),
      onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', id, 'site-reports'] }),
    }),
    addIssue: useMutation({
      mutationFn: (input: { title: string; description?: string; severity?: IssueSeverity; dueDate?: string }) =>
        projectsApi.addIssue(id, input),
      onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', id, 'issues'] }),
    }),
    updateIssueStatus: useMutation({
      mutationFn: ({ issueId, status }: { issueId: string; status: IssueStatus }) => projectsApi.updateIssue(id, issueId, { status }),
      onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', id, 'issues'] }),
    }),
  };
}
