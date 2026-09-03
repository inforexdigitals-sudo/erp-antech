import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Td, Th, Tr } from './ui/Table';
import { cn } from '../lib/utils';

export interface LineItemColumn<T> {
  key: keyof T;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: readonly string[];
  width?: string;
  min?: number;
  step?: number;
}

/**
 * Shared by every module with a line-item array in its create form
 * (Quotations, Purchase Orders, Variation Orders, RFQs, Material
 * Requests, Claims) — same add/remove-row shape, different field sets
 * per module supplied via `columns`. Not trying to be a generic form
 * builder beyond that: no validation, no nested arrays, just typed
 * rows of scalar fields, which is all any of these six actually need.
 */
export function LineItemsEditor<T extends object>({
  items,
  onChange,
  columns,
  newRow,
  minRows = 1,
  invalidRows,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  columns: LineItemColumn<T>[];
  newRow: () => T;
  minRows?: number;
  /** Row indices to flag (e.g. a blank description) — highlighted so the caller's own validation message points somewhere visible, instead of a submit just failing silently or surfacing a raw backend error. */
  invalidRows?: Set<number>;
}) {
  function updateRow(index: number, key: keyof T, value: unknown) {
    const next = items.slice();
    next[index] = { ...next[index], [key]: value };
    onChange(next);
  }

  function removeRow(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="overflow-x-auto rounded border border-line">
      <table className="w-full min-w-[560px]">
        <thead>
          <tr>
            <Th className="w-10">Sl. No.</Th>
            {columns.map((col) => (
              <Th key={String(col.key)}>{col.label}</Th>
            ))}
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {items.map((row, index) => (
            <Tr key={index} className={cn(invalidRows?.has(index) && 'bg-critical/5 outline outline-1 -outline-offset-1 outline-critical/40')}>
              <Td className="text-center text-muted">{index + 1}</Td>
              {columns.map((col) => (
                <Td key={String(col.key)} style={col.width ? { width: col.width } : undefined}>
                  {col.type === 'select' ? (
                    <Select
                      value={String(row[col.key] ?? '')}
                      onChange={(e) => updateRow(index, col.key, e.target.value)}
                      className="w-full"
                    >
                      {col.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      type={col.type}
                      min={col.min}
                      step={col.step}
                      value={(row[col.key] as string | number | undefined) ?? ''}
                      onChange={(e) =>
                        updateRow(index, col.key, col.type === 'number' ? Number(e.target.value) : e.target.value)
                      }
                      className="w-full"
                    />
                  )}
                </Td>
              ))}
              <Td>
                <Button size="sm" type="button" disabled={items.length <= minRows} onClick={() => removeRow(index)}>
                  Remove
                </Button>
              </Td>
            </Tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-line p-2.5">
        <Button size="sm" type="button" onClick={() => onChange([...items, newRow()])}>
          + Add Line
        </Button>
      </div>
    </div>
  );
}
