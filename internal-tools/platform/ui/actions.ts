"use server";

import { revalidatePath } from "next/cache";
import { getApp } from "@apps/registry";
import { runWithActor } from "@platform/auth/context";
import { requireUser } from "@platform/auth/session";
import { getRecord, updateRecord } from "@platform/db/generic";
import { assertCan, ForbiddenError } from "@platform/permissions/can";
import { ActionError } from "@platform/spec";

export type ActionResult = { ok: true } | { ok: false; error: string };

function toResult(error: unknown): ActionResult {
  if (error instanceof ForbiddenError || error instanceof ActionError) {
    return { ok: false, error: error.message };
  }
  console.error("[action] unexpected failure", error);
  return { ok: false, error: "Something went wrong. Check the server logs." };
}

/** Saves editable fields of one record. Field-level edit rights come from the spec. */
export async function saveRecordAction(
  appKey: string,
  id: string,
  values: Record<string, string>,
): Promise<ActionResult> {
  const user = await requireUser();
  const spec = getApp(appKey);
  if (!spec) return { ok: false, error: `Unknown app "${appKey}"` };

  try {
    return await runWithActor(user, async () => {
      assertCan(user, spec.key, "update");

      const data: Record<string, unknown> = {};
      for (const field of spec.fields) {
        if (!field.editableBy.includes(user.role) && user.role !== "admin") continue;
        if (!(field.field in values)) continue;
        const raw = values[field.field];
        data[field.field] = field.type === "number" || field.type === "money" ? Number(raw) : raw;
      }
      if (Object.keys(data).length === 0) {
        return { ok: false, error: "No editable fields for your role." };
      }

      const existing = await getRecord(spec, id);
      if (!existing) return { ok: false, error: "Record not found." };

      await updateRecord(spec, id, data);
      revalidatePath(`/tools/${spec.key}/${id}`);
      return { ok: true };
    });
  } catch (error) {
    return toResult(error);
  }
}

/** Runs one spec action. Permission enforcement lives inside the app's action. */
export async function runAppAction(
  appKey: string,
  actionKey: string,
  id: string,
  note?: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const spec = getApp(appKey);
  if (!spec) return { ok: false, error: `Unknown app "${appKey}"` };

  const action = spec.actions.find((candidate) => candidate.key === actionKey);
  if (!action) return { ok: false, error: `Unknown action "${actionKey}"` };
  if (action.requiresNote && !note?.trim()) return { ok: false, error: "A note is required." };

  try {
    return await runWithActor(user, async () => {
      await action.run(id, user, { note });
      revalidatePath(`/tools/${spec.key}`);
      revalidatePath(`/tools/${spec.key}/${id}`);
      return { ok: true };
    });
  } catch (error) {
    return toResult(error);
  }
}
