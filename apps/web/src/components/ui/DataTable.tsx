import type { ReactNode } from 'react';

interface DataTableProps {
  headers: ReactNode[];
  children: ReactNode;
  isEmpty?: boolean;
  emptyText?: string;
}

export function DataTable({ headers, children, isEmpty = false, emptyText = 'No data.' }: DataTableProps) {
  return (
    <div className="overflow-hidden rounded-md border border-line">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-line bg-surface-1">
              {headers.map((header, index) => (
                <th
                  key={index}
                  className="px-4 py-3 text-left font-mono text-xs font-semibold uppercase tracking-wide text-text-dim"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-line">
            {isEmpty ? (
              <tr>
                <td colSpan={headers.length} className="px-4 py-10 text-center text-sm text-text-muted">
                  {emptyText}
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

