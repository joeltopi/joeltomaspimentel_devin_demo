import { Prisma } from "@prisma/client";
import { rawDb } from "@platform/db/raw";
import { appForModel } from "./appIndex";
import { writeAudit } from "./write";

type Row = Record<string, unknown>;
type ReadDelegate = {
  findFirst: (args: { where?: unknown }) => Promise<Row | null>;
  findMany: (args: { where?: unknown }) => Promise<Row[]>;
};

function readDelegate(model: string): ReadDelegate | null {
  const key = model.charAt(0).toLowerCase() + model.slice(1);
  const delegate = (rawDb as unknown as Record<string, unknown>)[key];
  if (!delegate || typeof delegate !== "object") return null;
  return delegate as ReadDelegate;
}

/** Prisma values (Date, Decimal) are not plain JSON; normalise before storing. */
function toJson(row: Row | null | undefined): Prisma.InputJsonValue | null {
  if (!row) return null;
  return JSON.parse(JSON.stringify(row)) as Prisma.InputJsonValue;
}

function idOf(row: Row | null | undefined): string | null {
  const id = row?.id;
  return typeof id === "string" ? id : null;
}

/**
 * Audits every write on every model except AuditLog itself. Reads the previous
 * row(s) before update/delete so the trail carries a before/after pair.
 */
export const auditExtension = Prisma.defineExtension({
  name: "audit",
  query: {
    $allModels: {
      async create({ model, args, query }) {
        const result = (await query(args)) as Row;
        if (model !== "AuditLog") {
          await writeAudit({
            app: appForModel(model),
            model,
            recordId: idOf(result),
            action: "create",
            after: toJson(result),
          });
        }
        return result;
      },

      async update({ model, args, query }) {
        if (model === "AuditLog") return query(args);
        const before = (await readDelegate(model)?.findFirst({ where: args.where })) ?? null;
        const result = (await query(args)) as Row;
        await writeAudit({
          app: appForModel(model),
          model,
          recordId: idOf(result) ?? idOf(before),
          action: "update",
          before: toJson(before),
          after: toJson(result),
        });
        return result;
      },

      async delete({ model, args, query }) {
        if (model === "AuditLog") return query(args);
        const before = (await readDelegate(model)?.findFirst({ where: args.where })) ?? null;
        const result = await query(args);
        await writeAudit({
          app: appForModel(model),
          model,
          recordId: idOf(before),
          action: "delete",
          before: toJson(before),
        });
        return result;
      },

      async updateMany({ model, args, query }) {
        if (model === "AuditLog") return query(args);
        const before = (await readDelegate(model)?.findMany({ where: args.where })) ?? [];
        const result = await query(args);
        for (const row of before) {
          const after = (await readDelegate(model)?.findFirst({ where: { id: row.id } })) ?? null;
          await writeAudit({
            app: appForModel(model),
            model,
            recordId: idOf(row),
            action: "update",
            before: toJson(row),
            after: toJson(after),
          });
        }
        return result;
      },

      async deleteMany({ model, args, query }) {
        if (model === "AuditLog") return query(args);
        const before = (await readDelegate(model)?.findMany({ where: args.where })) ?? [];
        const result = await query(args);
        for (const row of before) {
          await writeAudit({
            app: appForModel(model),
            model,
            recordId: idOf(row),
            action: "delete",
            before: toJson(row),
          });
        }
        return result;
      },
    },
  },
});
