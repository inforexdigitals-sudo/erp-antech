import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Td, Th, Tr } from './ui/Table';

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
}: {
  items: T[];
  onChange: (items: T[]) => void;
  columns: LineItemColumn<T>[];
  newRow: () => T;
  minRows?: number;
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
            {columns.map((col) => (
              <Th key={String(col.key)}>{col.label}</Th>
            ))}
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {items.map((row, index) => (
            <Tr key={index}>
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
