import Link from "next/link";
import type { AppSpec, Row } from "@platform/spec";
import { idField } from "@platform/db/generic";
import { formatValue } from "./format";
import { ResourceFilters } from "./ResourceFilters";

export function ResourceTable({ spec, rows }: { spec: AppSpec; rows: Row[] }) {
  return (
    <div className="space-y-3">
      {spec.filters && spec.filters.length > 0 ? (
        <ResourceFilters filters={spec.filters} />
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {spec.columns.map((column) => (
                <th key={column.field} className="px-3 py-2 font-medium">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={spec.columns.length} className="px-3 py-6 text-center text-slate-500">
                  Nothing to show.
                </td>
              </tr>
            ) : null}
            {rows.map((row) => {
              const id = String(row[idField(spec)]);
              return (
                <tr key={id} className="border-t border-slate-100 hover:bg-slate-50">
                  {spec.columns.map((column, index) => (
                    <td key={column.field} className="px-3 py-2 align-top">
                      {index === 0 ? (
                        <Link
                          href={`/tools/${spec.key}/${id}`}
                          className="font-medium text-blue-700 hover:underline"
                        >
                          {formatValue(row[column.field], column.render)}
                        </Link>
                      ) : (
                        formatValue(row[column.field], column.render)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
