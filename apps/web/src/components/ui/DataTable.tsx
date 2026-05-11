import type { ReactNode } from 'react';

interface DataTableProps {
  headers: ReactNode[];
  children: ReactNode;
  isEmpty?: boolean;
  emptyText?: string;
}

export function DataTable({ headers, children, isEmpty = false, emptyText = 'No data.' }: DataTableProps) {
  return (
    <div className="overflow-hidden rounded-md border border-neutral bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-neutral bg-slate-50">
              {headers.map((header, index) => (
                <th
                  key={index}
                  className="px-4 py-3 text-left font-mono text-xs font-medium uppercase tracking-wide text-slate-500"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isEmpty ? (
              <tr>
                <td colSpan={headers.length} className="px-4 py-10 text-center text-sm text-slate-500">
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
