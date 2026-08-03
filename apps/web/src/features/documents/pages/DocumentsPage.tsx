import { ChangeEvent, FormEvent, useState } from 'react';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyNote, ErrorNote, Spinner } from '../../../components/ui/Feedback';
import { Field, Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Pagination } from '../../../components/ui/Pagination';
import { Select } from '../../../components/ui/Select';
import { DataTable, Td, Th, TableWrap, Tr } from '../../../components/ui/Table';
import { ApiError } from '../../../lib/api-client';
import { formatDate } from '../../../lib/utils';
import { usePickerProjects } from '../../shared/hooks';
import { documentsApi } from '../api';
import { useAddDocumentVersion, useCreateDocument, useDocument, useDocuments } from '../hooks';

const ENTITY_TYPES = ['project', 'quotation', 'purchase_order', 'claim', 'variation_order', 'company'] as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function RegisterDocumentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const projects = usePickerProjects();
  const create = useCreateDocument();
  const [relatedEntityType, setRelatedEntityType] = useState<string>('project');
  const [relatedEntityId, setRelatedEntityId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError('Choose a file — only its name/type/size are registered (storage isn’t wired up yet, see apps/api/README.md).');
      return;
    }
    try {
      await create.mutateAsync({
        relatedEntityType,
        relatedEntityId,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      });
      onClose();
      setFile(null);
      setRelatedEntityId('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not register this document.');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Register Document">
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <p className="text-xs text-muted">
          Storage isn&apos;t wired up yet — this records the file&apos;s name, type, and size (read from your file
          picker for real), not its actual bytes.
        </p>
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Related To" htmlFor="doc-entity-type">
            <Select id="doc-entity-type" value={relatedEntityType} onChange={(e) => { setRelatedEntityType(e.target.value); setRelatedEntityId(''); }}>
              {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </Select>
          </Field>
          {relatedEntityType === 'project' ? (
            <Field label="Project" htmlFor="doc-project">
              <Select id="doc-project" required value={relatedEntityId} onChange={(e) => setRelatedEntityId(e.target.value)}>
                <option value="" disabled>Select…</option>
                {projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
          ) : (
            <Field label={`${relatedEntityType} ID`} htmlFor="doc-entity-id">
              <Input id="doc-entity-id" required placeholder="UUID" value={relatedEntityId} onChange={(e) => setRelatedEntityId(e.target.value)} />
            </Field>
          )}
        </div>
        <Field label="File" htmlFor="doc-file">
          <input id="doc-file" type="file" onChange={onFileChange} className="text-[13px]" />
        </Field>
        {file && <p className="text-xs text-muted">{file.name} · {file.type || 'unknown type'} · {formatBytes(file.size)}</p>}
        {error && <p className="text-[12.5px] text-critical">{error}</p>}
        <Button type="submit" variant="primary" disabled={create.isPending || !relatedEntityId} className="self-end">
          {create.isPending ? 'Registering…' : 'Register Document'}
        </Button>
      </form>
    </Modal>
  );
}

function DetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: doc, isLoading, error } = useDocument(id);
  const addVersion = useAddDocumentVersion(id);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function onDownload() {
    setActionError(null);
    try {
      const { url } = await documentsApi.getDownloadUrl(id);
      setDownloadUrl(url);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not get a download URL.');
    }
  }

  async function onAddVersion(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setActionError(null);
    try {
      await addVersion.mutateAsync({ fileName: file.name, mimeType: file.type || 'application/octet-stream', sizeBytes: file.size });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not add this version.');
    }
  }

  return (
    <Modal open onClose={onClose} title={doc ? doc.fileName : 'Document'}>
      {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
      {error && <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load this document.'}</ErrorNote>}
      {doc && (
        <div className="flex flex-col gap-3.5">
          <div className="text-[13px] text-muted">{doc.relatedEntityType} · {doc.mimeType} · {formatBytes(doc.sizeBytes)} · uploaded by {doc.uploader.fullName}</div>

          {actionError && <ErrorNote>{actionError}</ErrorNote>}
          <div className="flex items-center gap-2">
            <Button onClick={onDownload}>Get Download URL</Button>
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-1.5 rounded border border-line-strong bg-surface px-3.5 py-[7px] text-[13px] font-semibold hover:bg-surface-2">
                + Add Version
              </span>
              <input type="file" className="hidden" onChange={onAddVersion} />
            </label>
          </div>
          {downloadUrl && (
            <p className="break-all rounded bg-surface-2 p-2.5 text-xs text-muted">
              {downloadUrl} <span className="italic">(stub reference — real object storage isn&apos;t wired up yet)</span>
            </p>
          )}

          <div>
            <div className="mb-1.5 text-[11.5px] font-semibold text-muted">Version History</div>
            <div className="flex flex-col gap-1 text-[13px]">
              {doc.versions.map((v) => (
                <div key={v.id} className="flex justify-between">
                  <span>v{v.versionNumber} {v.id === doc.currentVersionId && '(current)'}</span>
                  <span className="text-muted">{formatBytes(v.sizeBytes)} · {formatDate(v.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function DocumentsPage() {
  const [page, setPage] = useState(1);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data, isLoading, error } = useDocuments({ page, pageSize: 20 });

  return (
    <div>
      <PageHeader
        eyebrow="Insight & Admin"
        title="Documents"
        actions={<Button variant="primary" onClick={() => setRegisterOpen(true)}>+ Register Document</Button>}
      />

      <Card>
        {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
        {error && <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load documents.'}</ErrorNote>}
        {data && (
          <>
            <TableWrap>
              <DataTable>
                <thead><tr><Th>File</Th><Th>Related To</Th><Th numeric>Size</Th><Th>Uploaded</Th></tr></thead>
                <tbody>
                  {data.data.length === 0 && <tr><td colSpan={4}><EmptyNote>No documents registered yet.</EmptyNote></td></tr>}
                  {data.data.map((doc) => (
                    <Tr key={doc.id} className="cursor-pointer" onClick={() => setDetailId(doc.id)}>
                      <Td className="font-semibold">{doc.fileName}</Td>
                      <Td className="capitalize">{doc.relatedEntityType.replace(/_/g, ' ')}</Td>
                      <Td numeric>{formatBytes(doc.sizeBytes)}</Td>
                      <Td>{formatDate(doc.createdAt)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </DataTable>
            </TableWrap>
            <Pagination page={page} pageSize={20} total={data.meta.total} onPageChange={setPage} />
          </>
        )}
      </Card>

      <RegisterDocumentModal open={registerOpen} onClose={() => setRegisterOpen(false)} />
      {detailId && <DetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}
