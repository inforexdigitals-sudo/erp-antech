import { ChangeEvent, FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { ErrorNote, Spinner } from '../../../components/ui/Feedback';
import { Field, Input } from '../../../components/ui/Input';
import { Select, Textarea } from '../../../components/ui/Select';
import { DataTable, Td, Th, TableWrap, Tr } from '../../../components/ui/Table';
import { ApiError, fetchBlob } from '../../../lib/api-client';
import { formatDate } from '../../../lib/utils';
import { useCustomers } from '../../shared/hooks';
import { useConfirmImport, useExtractImport, useProjectImports } from '../hooks';
import type { ExtractResult } from '../api';

function ReviewForm({ result, onDone }: { result: ExtractResult; onDone: () => void }) {
  const navigate = useNavigate();
  const customers = useCustomers();
  const confirm = useConfirmImport();
  const { suggestions } = result;

  const [name, setName] = useState(suggestions.suggestedName);
  const [customerId, setCustomerId] = useState(suggestions.suggestedCustomerId ?? '');
  const [startDate, setStartDate] = useState(suggestions.suggestedStartDate ?? '');
  const [contractValue, setContractValue] = useState(suggestions.suggestedContractValue ?? 0);
  const [description, setDescription] = useState(`Digitized from ${result.import.fileName}`);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const project = await confirm.mutateAsync({
        id: result.import.id,
        input: {
          name,
          customerId,
          startDate: startDate || undefined,
          contractValue,
          description: description || undefined,
        },
      });
      onDone();
      navigate(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the project.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review before creating the project</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {suggestions.looksScanned && (
          <ErrorNote>
            This looks like a scanned or photographed document — automatic text extraction isn&apos;t available for
            it yet, so nothing below was guessed. Please fill in the details manually.
          </ErrorNote>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
            <Field label="Project Name" htmlFor="imp-name">
              <Input id="imp-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Customer" htmlFor="imp-customer">
              <Select id="imp-customer" required value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="" disabled>
                  Select a customer…
                </option>
                {customers.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              {suggestions.suggestedCustomerName && (
                <p className="mt-1 text-xs text-muted">Matched from the document: {suggestions.suggestedCustomerName}</p>
              )}
              {!suggestions.suggestedCustomerId && !suggestions.looksScanned && (
                <p className="mt-1 text-xs text-warning">Couldn&apos;t match a customer automatically — please pick one.</p>
              )}
            </Field>
            <Field label="Start Date" htmlFor="imp-date">
              <Input id="imp-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Contract Value" htmlFor="imp-value">
              <Input
                id="imp-value"
                type="number"
                min={0}
                step={0.01}
                value={contractValue}
                onChange={(e) => setContractValue(Number(e.target.value))}
              />
              {suggestions.suggestedContractValue !== null && (
                <p className="mt-1 text-xs text-muted">Guessed from the largest amount found in the document — please verify.</p>
              )}
            </Field>
            <Field label="Description" htmlFor="imp-desc">
              <Textarea id="imp-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            {error && <ErrorNote>{error}</ErrorNote>}
            <div className="flex gap-2">
              <Button type="submit" variant="primary" disabled={confirm.isPending || !customerId}>
                {confirm.isPending ? 'Creating…' : 'Create Project'}
              </Button>
              <Button type="button" onClick={onDone}>
                Cancel
              </Button>
            </div>
          </form>

          <div>
            <div className="mb-1.5 text-[11.5px] font-semibold text-muted">
              Extracted text — cross-check against the original before confirming
            </div>
            <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded border border-line bg-surface-2 p-3 text-[11.5px] leading-relaxed text-muted">
              {result.import.extractedText || 'No text could be extracted from this file.'}
            </pre>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UploadForm({ onExtracted }: { onExtracted: (result: ExtractResult) => void }) {
  const extract = useExtractImport();
  const [error, setError] = useState<string | null>(null);

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const result = await extract.mutateAsync(file);
      onExtracted(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not read this file.');
    } finally {
      e.target.value = '';
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <p className="text-[13px] text-muted">
          Upload an old quotation or project PDF — one that has real, selectable text (e.g. printed or exported from
          Excel/Word, not a scanned photo). We&apos;ll pull out what we can and show you a review screen before
          anything is saved.
        </p>
        <div className="flex items-center gap-3">
          <input type="file" accept="application/pdf" onChange={onFileChange} disabled={extract.isPending} className="text-[13px]" />
          {extract.isPending && <Spinner />}
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
      </CardContent>
    </Card>
  );
}

async function viewOriginal(id: string, fileName: string): Promise<void> {
  const blob = await fetchBlob(`/project-imports/${id}/file`);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  void fileName;
}

function ImportHistory() {
  const { data, isLoading, error } = useProjectImports();

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Previous Imports</CardTitle>
      </CardHeader>
      {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
      {error && <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load import history.'}</ErrorNote>}
      {data && (
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <Th>File</Th>
                <Th>Status</Th>
                <Th>Uploaded</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-[13px] text-muted">
                    No imports yet.
                  </td>
                </tr>
              )}
              {data.map((row) => (
                <Tr key={row.id}>
                  <Td>{row.fileName}</Td>
                  <Td className="capitalize">{row.status.replace(/_/g, ' ')}</Td>
                  <Td>{formatDate(row.createdAt)}</Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" onClick={() => viewOriginal(row.id, row.fileName)}>
                        View Original
                      </Button>
                      {row.projectId && (
                        <Button size="sm" variant="primary" onClick={() => window.location.assign(`/projects/${row.projectId}`)}>
                          Open Project
                        </Button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        </TableWrap>
      )}
    </Card>
  );
}

export function ImportProjectPage() {
  const [result, setResult] = useState<ExtractResult | null>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Delivery"
        title="Import from PDF"
        subtitle="Digitize an old Excel-exported or printed quotation/project PDF into a real project."
      />

      {result ? <ReviewForm result={result} onDone={() => setResult(null)} /> : <UploadForm onExtracted={setResult} />}

      <ImportHistory />
    </div>
  );
}
