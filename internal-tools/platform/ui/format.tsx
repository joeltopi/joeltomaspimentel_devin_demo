import type { ReactNode } from "react";
import type { Renderer } from "@platform/spec";
import { Chips, StatusBadge } from "./StatusBadge";

export function formatValue(value: unknown, render?: Renderer): ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-slate-400">—</span>;
  }

  switch (render) {
    case "status":
      return <StatusBadge value={String(value)} />;
    case "chips":
      return <Chips values={Array.isArray(value) ? value.map(String) : [String(value)]} />;
    case "money":
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
        Number(value),
      );
    case "datetime":
      return new Date(String(value)).toISOString().replace("T", " ").slice(0, 16);
    default:
      if (Array.isArray(value)) return value.join(", ");
      if (value instanceof Date) return value.toISOString().replace("T", " ").slice(0, 16);
      if (typeof value === "object") return JSON.stringify(value);
      return String(value);
  }
}
