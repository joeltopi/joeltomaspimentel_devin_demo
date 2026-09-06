import { db } from "./client";
import type { AppSpec, Row } from "@platform/spec";

type Delegate = {
  findMany: (args: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, string>;
    take?: number;
  }) => Promise<Row[]>;
  findUnique: (args: { where: Record<string, unknown> }) => Promise<Row | null>;
  update: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<Row>;
};

/**
 * Resolves the Prisma delegate named by a spec. Generic routes are typed
 * against `Row`; per-app type safety lives in the app's own actions.
 */
function delegateFor(spec: AppSpec): Delegate {
  const delegate = (db as unknown as Record<string, unknown>)[spec.model];
  if (!delegate) throw new Error(`Unknown Prisma model "${spec.model}" for app "${spec.key}"`);
  return delegate as Delegate;
}

export function idField(spec: AppSpec): string {
  return spec.idField ?? "id";
}

export async function listRecords(
  spec: AppSpec,
  filters: Record<string, string> = {},
): Promise<Row[]> {
  const where: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(filters)) {
    if (!value) continue;
    const filter = spec.filters?.find((candidate) => candidate.field === field);
    if (!filter) continue;
    where[field] = filter.multi ? { has: value } : value;
  }

  return delegateFor(spec).findMany({
    where,
    orderBy: spec.defaultSort ? { [spec.defaultSort.field]: spec.defaultSort.dir } : undefined,
    take: 200,
  });
}

export async function getRecord(spec: AppSpec, id: string): Promise<Row | null> {
  return delegateFor(spec).findUnique({ where: { [idField(spec)]: id } });
}

export async function updateRecord(
  spec: AppSpec,
  id: string,
  data: Record<string, unknown>,
): Promise<Row> {
  return delegateFor(spec).update({ where: { [idField(spec)]: id }, data });
}
