import { useState } from 'react';
import { PageHeader } from '../../../components/PageHeader';
import { EmptyNote, Spinner } from '../../../components/ui/Feedback';
import { Select } from '../../../components/ui/Select';
import { useProject } from '../../projects/hooks';
import { usePickerProjects } from '../../shared/hooks';
import { ProjectCostingPanel } from '../ProjectCostingPanel';

export function ProjectCostingPage() {
  const projects = usePickerProjects();
  const [projectId, setProjectId] = useState('');
  const { data: project } = useProject(projectId || undefined);

  return (
    <div>
      <PageHeader eyebrow="Commercials" title="Project Costing" />
      <div className="mb-3.5">
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="max-w-[280px]">
          <option value="">Select a project…</option>
          {projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </div>
      {projects.isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
      {!projectId && !projects.isLoading && <EmptyNote>Pick a project to see its budget and cost dashboard.</EmptyNote>}
      {projectId && project && <ProjectCostingPanel projectId={projectId} hasQuotation={!!project.quotationId} />}
    </div>
  );
}
