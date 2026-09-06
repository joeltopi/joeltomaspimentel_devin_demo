"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select, Textarea } from "./primitives";
import { saveRecordAction } from "./actions";

export type FormField = {
  field: string;
  label: string;
  type: string;
  options?: string[];
  editable: boolean;
  value: string;
};

export function ResourceForm({
  appKey,
  recordId,
  fields,
}: {
  appKey: string;
  recordId: string;
  fields: FormField[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const serverValues = Object.fromEntries(fields.map((field) => [field.field, field.value]));
  const serverKey = fields.map((field) => `${field.field}=${field.value}`).join("\u0000");
  const [values, setValues] = useState<Record<string, string>>(serverValues);
  const [renderedKey, setRenderedKey] = useState(serverKey);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (serverKey !== renderedKey) {
    setRenderedKey(serverKey);
    setValues(serverValues);
  }

  const editable = fields.filter((field) => field.editable);

  function save() {
    setMessage(null);
    startTransition(async () => {
      const payload = Object.fromEntries(
        editable.map((field) => [field.field, values[field.field] ?? ""]),
      );
      const result = await saveRecordAction(appKey, recordId, payload);
      setMessage(result.ok ? { ok: true, text: "Saved." } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <label key={field.field} className="block text-xs font-medium text-slate-600">
            <span className="mb-1 block">{field.label}</span>
            {field.type === "textarea" ? (
              <Textarea
                rows={3}
                disabled={!field.editable}
                value={values[field.field] ?? ""}
                onChange={(event) =>
                  setValues({ ...values, [field.field]: event.target.value })
                }
              />
            ) : field.type === "select" ? (
              <Select
                disabled={!field.editable}
                value={values[field.field] ?? ""}
                onChange={(event) =>
                  setValues({ ...values, [field.field]: event.target.value })
                }
              >
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                disabled={!field.editable}
                value={values[field.field] ?? ""}
                onChange={(event) =>
                  setValues({ ...values, [field.field]: event.target.value })
                }
              />
            )}
          </label>
        ))}
      </div>

      {editable.length > 0 ? (
        <div className="flex items-center gap-3">
          <Button variant="primary" disabled={pending} onClick={save}>
            Save
          </Button>
          {message ? (
            <span className={`text-sm ${message.ok ? "text-green-700" : "text-red-700"}`}>
              {message.text}
            </span>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-slate-500">This record is read-only for your role.</p>
      )}
    </div>
  );
}
