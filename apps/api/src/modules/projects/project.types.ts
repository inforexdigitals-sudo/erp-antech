/** Matches the CHECK constraint on projects.status (db/migrations/0004). */
export const PROJECT_STATUSES = ['planning', 'active', 'on_hold', 'completed', 'closed', 'cancelled'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** Matches the CHECK constraint on project_milestones.status. */
export const MILESTONE_STATUSES = ['pending', 'in_progress', 'completed', 'delayed'] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

/** Matches the CHECK constraint on project_tasks.status. */
export const TASK_STATUSES = ['todo', 'in_progress', 'done', 'blocked'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Matches the CHECK constraint on project_issues.severity. */
export const ISSUE_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number];

/** Matches the CHECK constraint on project_issues.status. */
export const ISSUE_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];
