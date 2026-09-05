import Link from "next/link";
import type { AppSpec, Row } from "@platform/spec";
import { idField } from "@platform/db/generic";
import { formatValue } from "./format";

export function ResourceTable({
  spec,
  rows,
  filters,
}: {
  spec: AppSpec;
  rows: Row[];
  filters: Record<string, string>;
}) {
  return (
    <div className="space-y-3">
      {spec.filters && spec.filters.length > 0 ? (
        <form className="flex flex-wrap items-end gap-3" method="get">
          {spec.filters.map((filter) => (
            <label key={filter.field} className="text-xs font-medium text-slate-600">
              <span className="mb-1 block">{filter.label}</span>
              <select
                name={filter.field}
                defaultValue={filters[filter.field] ?? ""}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
              >
                <option value="">All</option>
                {filter.options.map((option) => (
                  <option key={option} value={option}>
                    {option.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button
            type="submit"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Apply
          </button>
        </form>
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
