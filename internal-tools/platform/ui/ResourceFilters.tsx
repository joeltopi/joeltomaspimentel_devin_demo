"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { FilterSpec } from "@platform/spec";

function read(query: string, fields: string[]): Record<string, string> {
  const params = new URLSearchParams(query);
  return Object.fromEntries(fields.map((field) => [field, params.get(field) ?? ""]));
}

export function ResourceFilters({ filters }: { filters: FilterSpec[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const fields = filters.map((filter) => filter.field);
  const query = searchParams.toString();

  /**
   * The selection, not the URL, is what the next navigation is built from: a
   * second choice made while the first is still in flight would otherwise
   * rebuild from a query string that does not have the first one yet.
   */
  const [selection, setSelection] = useState(() => read(query, fields));
  const key = fields.join(",");
  useEffect(() => {
    setSelection(read(query, key.split(",")));
  }, [query, key]);

  function apply(field: string, value: string): void {
    const next = { ...selection, [field]: value };
    setSelection(next);

    const params = new URLSearchParams(searchParams.toString());
    for (const [name, selected] of Object.entries(next)) {
      if (selected) params.set(name, selected);
      else params.delete(name);
    }
    const search = params.toString();
    startTransition(() => router.replace(search ? `${pathname}?${search}` : pathname));
  }

  return (
    <div
      className={`flex flex-wrap items-end gap-3 ${pending ? "opacity-60" : ""}`}
      aria-busy={pending}
    >
      {filters.map((filter) => (
        <label key={filter.field} className="text-xs font-medium text-slate-600">
          <span className="mb-1 block">{filter.label}</span>
          <select
            name={filter.field}
            value={selection[filter.field] ?? ""}
            onChange={(event) => apply(filter.field, event.target.value)}
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
    </div>
  );
}
