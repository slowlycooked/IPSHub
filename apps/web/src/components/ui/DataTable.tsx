import type { ReactNode } from 'react';

interface DataTableProps {
  headers: ReactNode[];
  children: ReactNode;
  isEmpty?: boolean;
  emptyText?: string;
}

export function DataTable({ headers, children, isEmpty = false, emptyText = 'No data.' }: DataTableProps) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-line/70 bg-panel-strong/90">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-line/70 bg-white/[0.03]">
              {headers.map((header, index) => (
                <th
                  key={index}
                  className="px-4 py-4 text-left font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-text-dim"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
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
