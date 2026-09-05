"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { FilterSpec } from "@platform/spec";

export function ResourceFilters({
  filters,
  values,
}: {
  filters: FilterSpec[];
  values: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function apply(field: string, value: string): void {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(field, value);
    else next.delete(field);
    const query = next.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname));
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
            value={values[filter.field] ?? ""}
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
