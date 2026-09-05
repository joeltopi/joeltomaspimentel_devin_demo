import { notFound } from "next/navigation";
import { getApp } from "@apps/registry";
import { requireUser } from "@platform/auth/session";
import { listRecords } from "@platform/db/generic";
import { can } from "@platform/permissions/can";
import { Forbidden } from "@platform/ui/Forbidden";
import { ResourceTable } from "@platform/ui/ResourceTable";
import { Shell } from "@platform/ui/Shell";

export default async function AppListPage({
  params,
  searchParams,
}: {
  params: Promise<{ app: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const { app } = await params;
  const spec = getApp(app);
  if (!spec) notFound();

  if (!can(user, spec.key, "read")) {
    return <Forbidden user={user} resource={spec.key} action="read" />;
  }

  const query = await searchParams;
  const filters: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") filters[key] = value;
  }

  const rows = await listRecords(spec, filters);

  return (
    <Shell user={user}>
      <h1 className="text-xl font-semibold">{spec.title}</h1>
      <p className="mb-6 text-sm text-slate-600">{spec.description}</p>
      <ResourceTable spec={spec} rows={rows} />
    </Shell>
  );
}
