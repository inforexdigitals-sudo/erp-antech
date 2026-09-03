import { ChangeEvent, FormEvent, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineItemsEditor, type LineItemColumn } from '../../../components/LineItemsEditor';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent } from '../../../components/ui/Card';
import { ErrorNote, Spinner } from '../../../components/ui/Feedback';
import { Field, Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { ApiError } from '../../../lib/api-client';
import { COST_CATEGORIES } from '../../shared/constants';
import { useCustomers } from '../../shared/hooks';
import { useCreateQuotation, useImportQuotationItems } from '../hooks';
import type { QuotationItemInput } from '../api';

/** unit isn't shown as a column anymore, but QuotationItemInputDto still requires a non-empty string server-side — default it rather than surface it. */
function newItem(): QuotationItemInput {
  return { description: '', category: 'material', unit: 'unit', quantity: 1, unitCost: 0, unitPrice: 0 };
}

const COLUMNS: LineItemColumn<QuotationItemInput>[] = [
  { key: 'description', label: 'Description', type: 'text', width: '32%' },
  { key: 'category', label: 'Category', type: 'select', options: COST_CATEGORIES, width: '16%' },
  { key: 'quantity', label: 'Qty', type: 'number', min: 0, step: 0.01, width: '12%' },
  { key: 'unitCost', label: 'Unit Cost', type: 'number', min: 0, step: 0.01, width: '14%' },
  { key: 'unitPrice', label: 'Unit Price', type: 'number', min: 0, step: 0.01, width: '14%' },
];

export function CreateQuotationPage() {
  const navigate = useNavigate();
  const customers = useCustomers();
  const create = useCreateQuotation();
  const importItems = useImportQuotationItems();
  const importInputRef = useRef<HTMLInputElement>(null);

  const [customerId, setCustomerId] = useState('');
  const [title, setTitle] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<QuotationItemInput[]>([newItem()]);
  const [error, setError] = useState<string | null>(null);
  const [invalidRows, setInvalidRows] = useState<Set<number>>(new Set());
  const [importNote, setImportNote] = useState<string | null>(null);

  async function onImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setImportNote(null);
    try {
      const imported = await importItems.mutateAsync(file);
      if (imported.length === 0) {
        setError("Couldn't find any line items in that file — check it has a Description column (or column of item names) with rows below it.");
        return;
      }
      // Appended, never replacing — a blank starter row (nothing typed into it yet) is dropped so it doesn't linger as an empty line; anything the user already filled in is kept.
      setItems((current) => [...current.filter((item) => item.description.trim() || item.quantity !== 1 || item.unitPrice !== 0), ...imported]);
      setInvalidRows(new Set());
      setImportNote(`Imported ${imported.length} line item${imported.length === 1 ? '' : 's'} from ${file.name} — review before creating.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not read that file.');
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const blankRows = new Set(items.flatMap((item, i) => (item.description.trim() ? [] : [i])));
    if (blankRows.size > 0) {
      setInvalidRows(blankRows);
      setError(
        blankRows.size === 1
          ? `Line ${[...blankRows][0] + 1} needs a description.`
          : `Lines ${[...blankRows].map((i) => i + 1).join(', ')} need a description.`,
      );
      return;
    }
    setInvalidRows(new Set());

    try {
      const quotation = await create.mutateAsync({
        customerId,
        title,
        validUntil: validUntil || undefined,
        discountAmount: discountAmount || undefined,
        notes: notes || undefined,
        items,
      });
      navigate(`/quotations/${quotation.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  const estimatedTotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0) - discountAmount;

  return (
    <div>
      <PageHeader eyebrow="Delivery" title="New Quotation" />
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Card>
          <CardContent className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <Field label="Customer" htmlFor="q-customer">
              <Select id="q-customer" required value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="" disabled>Select a customer…</option>
                {customers.data?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Title" htmlFor="q-title">
              <Input id="q-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Valid Until" htmlFor="q-valid">
              <Input id="q-valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[13.5px] font-semibold">Line Items</h3>
              <div className="flex items-center gap-2">
                {importItems.isPending && <Spinner />}
                <Button
                  type="button"
                  size="sm"
                  onClick={() => importInputRef.current?.click()}
                  disabled={importItems.isPending}
                >
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
            </div>
            {importNote && <p className="text-xs text-muted">{importNote}</p>}
            <LineItemsEditor items={items} onChange={setItems} columns={COLUMNS} newRow={newItem} invalidRows={invalidRows} />
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <Field label="Discount Amount" htmlFor="q-discount">
                <Input
                  id="q-discount"
                  type="number"
                  min={0}
                  step={0.01}
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Number(e.target.value))}
                />
              </Field>
              <div className="flex flex-col justify-end text-sm text-muted sm:col-span-2">
                Estimated total (before tax): <span className="num font-semibold text-ink">${estimatedTotal.toFixed(2)}</span>
              </div>
            </div>
            <Field label="Notes" htmlFor="q-notes">
              <textarea
                id="q-notes"
                rows={2}
                className="rounded border border-line-strong bg-surface px-2.5 py-[7px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </CardContent>
        </Card>

        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={() => navigate('/quotations')}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={create.isPending || !customerId}>
            {create.isPending ? 'Creating…' : 'Create Quotation'}
          </Button>
        </div>
      </form>
    </div>
  );
}
