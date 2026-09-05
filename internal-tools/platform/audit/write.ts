import type { Prisma } from "@prisma/client";
import { getActor } from "@platform/auth/context";
import { rawDb } from "@platform/db/raw";

export type AuditEntry = {
  app?: string | null;
  model: string;
  recordId?: string | null;
  action: "create" | "update" | "delete" | "integration";
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  meta?: Prisma.InputJsonValue | null;
};

/**
 * Writes one audit row, attributing it to the ambient actor (see
 * `runWithActor`). Writes through `rawDb` so audit rows are never themselves
 * audited. Never throws into the caller's transaction path: an audit failure is
 * logged, because losing the business write is worse than losing the trail —
 * a real deployment would ship the trail to an append-only sink instead.
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  const actor = getActor();
  try {
    await rawDb.auditLog.create({
      data: {
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? "system",
        actorRole: actor?.role ?? null,
        app: entry.app ?? null,
        model: entry.model,
        recordId: entry.recordId ?? null,
        action: entry.action,
        before: entry.before ?? undefined,
        after: entry.after ?? undefined,
        meta: entry.meta ?? undefined,
      },
    });
  } catch (error) {
    console.error("[audit] failed to write audit row", entry.model, entry.action, error);
  }
}
