import Link from "next/link";
import { notFound } from "next/navigation";
import { getApp } from "@apps/registry";
import { requireUser } from "@platform/auth/session";
import { getRecord } from "@platform/db/generic";
import { assertCan, can } from "@platform/permissions/can";
import { ActionBar, type ActionButton } from "@platform/ui/ActionBar";
import { ResourceForm, type FormField } from "@platform/ui/ResourceForm";
import { Shell } from "@platform/ui/Shell";
import { Card } from "@platform/ui/primitives";
import { StatusBadge } from "@platform/ui/StatusBadge";

function toInputValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value) || typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default async function RecordPage({
  params,
}: {
  params: Promise<{ app: string; id: string }>;
}) {
  const user = await requireUser();
  const { app, id } = await params;
  const spec = getApp(app);
  if (!spec) notFound();

  assertCan(user, spec.key, "read");

  const record = await getRecord(spec, id);
  if (!record) notFound();

  const canUpdate = can(user, spec.key, "update");
  const fields: FormField[] = spec.fields.map((field) => ({
    field: field.field,
    label: field.label,
    type: field.type,
    options: field.options,
    editable:
      canUpdate && (user.role === "admin" || field.editableBy.includes(user.role)),
    value: toInputValue(record[field.field]),
  }));

  const actions: ActionButton[] = spec.actions
    .filter((action) => can(user, spec.key, action.key))
    .filter((action) => (action.visibleWhen ? action.visibleWhen(record, user) : true))
    .map((action) => ({
      key: action.key,
      label: action.label,
      variant: action.variant,
      requiresNote: action.requiresNote,
    }));

  const status = spec.statusField ? String(record[spec.statusField]) : null;

  return (
    <Shell user={user}>
      <div className="mb-6 flex items-center gap-3">
        <Link href={`/tools/${spec.key}`} className="text-sm text-blue-700 hover:underline">
          ← {spec.title}
        </Link>
        {status ? <StatusBadge value={status} /> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <ResourceForm appKey={spec.key} recordId={id} fields={fields} />
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Actions</h2>
          <ActionBar appKey={spec.key} recordId={id} actions={actions} user={user} />
        </Card>
      </div>
    </Shell>
  );
}
