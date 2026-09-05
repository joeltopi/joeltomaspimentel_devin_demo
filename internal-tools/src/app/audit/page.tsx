import { requireUser } from "@platform/auth/session";
import { rawDb } from "@platform/db/raw";
import { can } from "@platform/permissions/can";
import { Forbidden } from "@platform/ui/Forbidden";
import { Shell } from "@platform/ui/Shell";
import { StatusBadge } from "@platform/ui/StatusBadge";

const FILTERS = ["app", "model", "action", "actorName"] as const;

function diff(before: unknown, after: unknown): string {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].sort();
  const lines = keys
    .filter((key) => JSON.stringify(b[key]) !== JSON.stringify(a[key]))
    .map((key) => `${key}: ${JSON.stringify(b[key]) ?? "—"} → ${JSON.stringify(a[key]) ?? "—"}`);
  return lines.length > 0 ? lines.join("\n") : "no field changes";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  if (!can(user, "audit", "read")) {
    return <Forbidden user={user} resource="audit" action="read" />;
  }

  const query = await searchParams;
  const where: Record<string, string> = {};
  for (const key of FILTERS) {
    const value = query[key];
    if (typeof value === "string" && value) where[key] = value;
  }

  const rows = await rawDb.auditLog.findMany({
    where,
    orderBy: { at: "desc" },
    take: 200,
  });

  return (
    <Shell user={user}>
      <h1 className="text-xl font-semibold">Audit log</h1>
      <p className="mb-6 text-sm text-slate-600">
        Every write and every integration call, newest first. Written by the platform, not by app
        code.
      </p>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        {FILTERS.map((key) => (
          <label key={key} className="text-xs font-medium text-slate-600">
            <span className="mb-1 block">{key}</span>
            <input
              name={key}
              defaultValue={where[key] ?? ""}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
        ))}
        <button
          type="submit"
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Actor</th>
              <th className="px-3 py-2 font-medium">App</th>
              <th className="px-3 py-2 font-medium">Model</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  No audit rows match.
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100 align-top">
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                  {row.at.toISOString().replace("T", " ").slice(0, 19)}
                </td>
                <td className="px-3 py-2">
                  {row.actorName}
                  {row.actorRole ? (
                    <span className="ml-1 text-xs text-slate-500">({row.actorRole})</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-slate-600">{row.app ?? "—"}</td>
                <td className="px-3 py-2 text-slate-600">{row.model}</td>
                <td className="px-3 py-2">
                  <StatusBadge value={row.action} />
                </td>
                <td className="px-3 py-2">
                  <details>
                    <summary className="cursor-pointer text-blue-700">
                      {row.action === "integration" ? "call" : "changes"}
                    </summary>
                    <pre className="mt-2 max-w-xl whitespace-pre-wrap break-all rounded bg-slate-50 p-2 text-xs text-slate-700">
                      {row.action === "integration"
                        ? JSON.stringify(row.meta, null, 2)
                        : diff(row.before, row.after)}
                    </pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
