import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { LineItemsEditor, type LineItemColumn } from '../../../components/LineItemsEditor';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent } from '../../../components/ui/Card';
import { ErrorNote, Spinner } from '../../../components/ui/Feedback';
import { Field, Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { ApiError } from '../../../lib/api-client';
import { useCustomers, usePickerProjects, usePickerSubcontractors } from '../../shared/hooks';
import { quotationsApi } from '../../quotations/api';
import { useImportQuotationItems, useQuotations } from '../../quotations/hooks';
import { recalcClaimRow } from '../line-calc';
import { claimsApi } from '../api';
import { useBoqLines, useCreateClaim, useSaveProjectBoq } from '../hooks';
import type { ClaimItemInput, ClaimType } from '../api';

/** `unitPrice` and `previousPercent` are reference-only — unitPrice drives the auto-computed Amount below, previousPercent shows how much of this BOQ line is already claimed elsewhere so "This Period %" makes sense; neither is part of ClaimItemInput, so both are stripped before submit (see onSubmit). */
interface ClaimLineRow extends ClaimItemInput {
  unitPrice?: number;
  previousPercent?: number;
  /** Quantity done this period - a typing convenience (see recalcClaimRow), stripped before submit. */
  periodQty?: number;
  /** Only used when saving the lines as the project's BOQ (see onSubmit) - never sent with the claim itself. */
  unit?: string;
}

function newItem(): ClaimLineRow {
  return { description: '', currentPercent: 0, amount: 0 };
}

const COLUMNS: LineItemColumn<ClaimLineRow>[] = [
  { key: 'description', label: 'Description', type: 'text', width: '25%' },
  { key: 'contractQuantity', label: 'Qty', type: 'number', min: 0, step: 0.01, width: '9%' },
  { key: 'unitPrice', label: 'Unit Price ($)', type: 'number', min: 0, step: 0.01, width: '11%' },
  { key: 'previousPercent', label: 'Already Claimed %', type: 'readonly', width: '10%', suffix: '%' },
  { key: 'periodQty', label: 'This Period Qty', type: 'number', min: 0, step: 0.01, width: '12%' },
  { key: 'currentPercent', label: 'This Period %', type: 'number', min: 0, step: 0.1, width: '11%' },
  { key: 'amount', label: 'Amount ($)', type: 'number', min: 0, step: 0.01, width: '12%' },
];

export function CreateClaimPage() {
  const navigate = useNavigate();
  const projects = usePickerProjects();
  const customers = useCustomers();
  const subcontractors = usePickerSubcontractors();
  const create = useCreateClaim();
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  // Which button was pressed: 'Save as Draft' just creates the claim; 'Save & Submit' also sends it for approval straight away.
  const submitAfterSave = useRef(false);
  const importItems = useImportQuotationItems();
  const importInputRef = useRef<HTMLInputElement>(null);
  const quotations = useQuotations({ pageSize: 100 });
  const [loadingQuotation, setLoadingQuotation] = useState(false);

  const [projectId, setProjectId] = useState('');
  const [claimType, setClaimType] = useState<ClaimType>('client');
  const [customerId, setCustomerId] = useState('');
  const [subcontractorId, setSubcontractorId] = useState('');
  const [claimPeriodStart, setClaimPeriodStart] = useState('');
  const [claimPeriodEnd, setClaimPeriodEnd] = useState('');
  const [retentionPercent, setRetentionPercent] = useState(5);
  const [items, setItems] = useState<ClaimLineRow[]>([newItem()]);
  const [error, setError] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [saveBoq, setSaveBoq] = useState(true);

  const boqLines = useBoqLines(projectId || undefined);
  const saveProjectBoq = useSaveProjectBoq(projectId);
  // A project with no BOQ on file yet (no quotation, nothing saved before) - the only case where lines entered by hand can also be remembered for next time.
  const needsBoq = !!projectId && !!boqLines.data && boqLines.data.length === 0;
  // Set once this form's lines have been saved as the project's BOQ, so a retry after a failed Create doesn't try to save them a second time.
  const boqSaved = useRef(false);
  // Guards against re-applying the same project's BOQ on every render, while
  // still re-applying when the project actually changes (including back to
  // one already fetched, since react-query would resolve that instantly).
  const loadedForProjectId = useRef<string | null>(null);

  useEffect(() => {
    if (!projectId || !boqLines.data || loadedForProjectId.current === projectId) return;
    loadedForProjectId.current = projectId;
    if (boqLines.data.length > 0) {
      setItems(
        boqLines.data.map((line) => ({
          quotationItemId: line.quotationItemId ?? undefined,
          projectBoqItemId: line.projectBoqItemId ?? undefined,
          description: line.description,
          contractQuantity: line.quantity,
          unitPrice: line.unitPrice,
          previousPercent: line.previousPercent,
          periodQty: 0,
          currentPercent: 0,
          amount: 0,
        })),
      );
    }
  }, [projectId, boqLines.data]);

  function onProjectChange(nextProjectId: string) {
    setProjectId(nextProjectId);
    loadedForProjectId.current = null;
    boqSaved.current = false;
    setImportNote(null);
    setItems([newItem()]);
  }

  // For a project that wasn't created through "Convert to Project" (so it has no linked quotation) but whose quotation does exist: copy that quotation's lines in.
  async function onLoadFromQuotation(quotationId: string) {
    if (!quotationId) return;
    setError(null);
    setImportNote(null);
    setLoadingQuotation(true);
    try {
      const quotation = await quotationsApi.get(quotationId);
      const quoteItems = quotation.currentRevision?.items ?? [];
      if (quoteItems.length === 0) {
        setError(`${quotation.quotationNumber} has no priced line items to load.`);
        return;
      }
      setItems(
        quoteItems.map((item) => ({
          description: item.description,
          unit: item.unit,
          contractQuantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          periodQty: 0,
          currentPercent: 0,
          amount: 0,
        })),
      );
      setImportNote(`Loaded ${quoteItems.length} lines from ${quotation.quotationNumber} - set This Period % per line.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load that quotation.');
    } finally {
      setLoadingQuotation(false);
    }
  }

  async function onImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setImportNote(null);
    try {
      const imported = await importItems.mutateAsync(file);
      if (imported.length === 0) {
        setError("Couldn't find any line items in that file - check it has a Description column with rows below it.");
        return;
      }
      const rows: ClaimLineRow[] = imported.map((line) => ({
        description: line.description,
        unit: line.unit,
        contractQuantity: line.quantity,
        unitPrice: line.unitPrice,
        periodQty: 0,
        currentPercent: 0,
        amount: 0,
      }));
      setItems((current) => [...current.filter((item) => item.description.trim()), ...rows]);
      setImportNote(`Imported ${rows.length} line${rows.length === 1 ? '' : 's'} from ${file.name} - review, then set This Period % per line.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not read that file.');
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  }

  function onItemsChange(next: ClaimLineRow[]) {
    setItems(next.map((row, i) => recalcClaimRow(items[i], row)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      let claimItems = items;
      if (needsBoq && saveBoq && !boqSaved.current) {
        const toSave = items.filter((item) => item.description.trim());
        if (toSave.length === 0) {
          setError('Add at least one line with a description.');
          return;
        }
        const saved = await saveProjectBoq.mutateAsync(
          toSave.map((item) => ({
            description: item.description.trim(),
            unit: item.unit,
            quantity: item.contractQuantity ?? 1,
            unitPrice: item.unitPrice ?? 0,
          })),
        );
        // Same order in, same order out - link each claim line to the BOQ line just created for it.
        claimItems = toSave.map((item, i) => ({ ...item, projectBoqItemId: saved[i]?.projectBoqItemId ?? undefined }));
        boqSaved.current = true;
        setItems(claimItems);
      }

      const claim = await create.mutateAsync({
        projectId,
        claimType,
        customerId: claimType === 'client' ? customerId : undefined,
        subcontractorId: claimType === 'subcontractor' ? subcontractorId : undefined,
        claimPeriodStart,
        claimPeriodEnd,
        retentionPercent: retentionPercent || undefined,
        items: claimItems.map(({ unitPrice: _unitPrice, previousPercent: _previousPercent, periodQty: _periodQty, unit: _unit, ...item }) => item),
      });
      if (submitAfterSave.current) {
        try {
          await claimsApi.submitForApproval(claim.id);
          await queryClient.invalidateQueries({ queryKey: ['claims'] });
        } catch {
          // The claim itself saved fine - it's just still a draft. Its page has the Submit button and will show why submitting failed.
        }
      }
      navigate(`/claims/${claim.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  const claimAmount = items.reduce((sum, i) => sum + i.amount, 0);
  const retentionAmount = claimAmount * (retentionPercent / 100);

  return (
    <div>
      <PageHeader eyebrow="Commercials" title="New Progress Claim" />
      <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
        <Card>
          <CardContent className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <Field label="Project" htmlFor="c-project">
              <Select id="c-project" required value={projectId} onChange={(e) => onProjectChange(e.target.value)}>
                <option value="" disabled>Select…</option>
                {projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Claim Type" htmlFor="c-type">
              <Select id="c-type" value={claimType} onChange={(e) => setClaimType(e.target.value as ClaimType)}>
                <option value="client">Client</option>
                <option value="subcontractor">Subcontractor</option>
              </Select>
            </Field>
            {claimType === 'client' ? (
              <Field label="Customer" htmlFor="c-customer">
                <Select id="c-customer" required value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="" disabled>Select…</option>
                  {customers.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
            ) : (
              <Field label="Subcontractor" htmlFor="c-subcontractor">
                <Select id="c-subcontractor" required value={subcontractorId} onChange={(e) => setSubcontractorId(e.target.value)}>
                  <option value="" disabled>Select…</option>
                  {subcontractors.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Claim Period Start" htmlFor="c-start">
              <Input id="c-start" type="date" required value={claimPeriodStart} onChange={(e) => setClaimPeriodStart(e.target.value)} />
            </Field>
            <Field label="Claim Period End" htmlFor="c-end">
              <Input id="c-end" type="date" required value={claimPeriodEnd} onChange={(e) => setClaimPeriodEnd(e.target.value)} />
            </Field>
            <Field label="Retention %" htmlFor="c-retention">
              <Input id="c-retention" type="number" min={0} max={100} step={0.1} value={retentionPercent} onChange={(e) => setRetentionPercent(Number(e.target.value))} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[13.5px] font-semibold">BOQ Lines</h3>
              {needsBoq && (
                <div className="flex items-center gap-2">
                  {(importItems.isPending || loadingQuotation) && <Spinner />}
                  <Select
                    value=""
                    onChange={(e) => onLoadFromQuotation(e.target.value)}
                    disabled={loadingQuotation}
                    className="max-w-[260px] py-[5px] text-xs"
                    aria-label="Load lines from a quotation"
                  >
                    <option value="">Load lines from a quotation…</option>
                    {quotations.data?.data
                      .filter((q) => q.status !== 'rejected' && q.status !== 'expired')
                      .map((q) => (
                        <option key={q.id} value={q.id}>{q.quotationNumber} — {q.title}</option>
                      ))}
                  </Select>
                  <Button type="button" size="sm" onClick={() => importInputRef.current?.click()} disabled={importItems.isPending}>
                    Import from PDF or Excel
                  </Button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".pdf,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    onChange={onImportFile}
                    className="hidden"
                  />
                </div>
              )}
            </div>
            {importNote && <p className="text-xs text-muted">{importNote}</p>}
            <p className="text-xs text-muted">
              {!projectId
                ? 'Select a project above to pull in its quoted BOQ lines automatically.'
                : boqLines.isLoading
                  ? 'Loading BOQ lines from the project…'
                  : boqLines.data && boqLines.data.length > 0
                    ? 'Lines are pre-filled from the project\'s quotation — adjust Qty, Unit Price or This Period % as needed, or add extra lines manually. Amount is calculated automatically.'
                    : 'This project has no BOQ saved yet — load its lines from a quotation, import them from a PDF/Excel file, or type them below.'}
            </p>
            <LineItemsEditor items={items} onChange={onItemsChange} columns={COLUMNS} newRow={newItem} />
            {needsBoq && (
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={saveBoq} onChange={(e) => setSaveBoq(e.target.checked)} />
                Save these lines as this project&apos;s BOQ - future claims will load them automatically
              </label>
            )}
            <div className="ml-auto flex max-w-[260px] flex-col gap-1 text-[13px]">
              <div className="flex justify-between"><span className="text-muted">Claim Amount</span><span className="num">${claimAmount.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Retention</span><span className="num">-${retentionAmount.toFixed(2)}</span></div>
              <div className="flex justify-between border-t border-line pt-1 font-semibold"><span>Net Claim</span><span className="num">${(claimAmount - retentionAmount).toFixed(2)}</span></div>
            </div>
          </CardContent>
        </Card>

        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex flex-col items-end gap-2">
          <p className="text-xs text-muted">
            Save as Draft keeps the claim private to prepare — you can edit or delete it later, and submit it for approval from its page when it's ready.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => navigate('/claims')}>Cancel</Button>
            <Button
              type="button"
              disabled={create.isPending || saveProjectBoq.isPending || !projectId}
              onClick={() => {
                submitAfterSave.current = true;
                formRef.current?.requestSubmit();
              }}
            >
              Save &amp; Submit for Approval
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={create.isPending || saveProjectBoq.isPending || !projectId}
              onClick={() => {
                submitAfterSave.current = false;
              }}
            >
              {create.isPending ? 'Saving…' : 'Save as Draft'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
