"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Actor } from "@platform/permissions/can";
import { Button, Textarea } from "./primitives";
import { runAppAction } from "./actions";

export type ActionButton = {
  key: string;
  label: string;
  variant?: "primary" | "danger" | "default";
  requiresNote?: boolean;
};

export function ActionBar({
  appKey,
  recordId,
  actions,
  user,
}: {
  appKey: string;
  recordId: string;
  actions: ActionButton[];
  user: Actor;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (actions.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No actions available to {user.role.replace(/_/g, " ")} on this record.
      </p>
    );
  }

  function run(action: ActionButton) {
    setError(null);
    startTransition(async () => {
      const result = await runAppAction(appKey, action.key, recordId, note);
      if (result.ok) {
        setNote("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const needsNote = actions.some((action) => action.requiresNote);

  return (
    <div className="space-y-3">
      {needsNote ? (
        <label className="block text-xs font-medium text-slate-600">
          <span className="mb-1 block">Decision note (required for decisions)</span>
          <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.key}
            variant={action.variant ?? "default"}
            disabled={pending}
            onClick={() => run(action)}
          >
            {action.label}
          </Button>
        ))}
      </div>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
