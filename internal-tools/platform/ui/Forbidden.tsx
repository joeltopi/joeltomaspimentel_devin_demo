import Link from "next/link";
import type { Actor } from "@platform/permissions/can";
import { ROLE_LABELS } from "@platform/permissions/roles";
import { Shell } from "./Shell";
import { Card } from "./primitives";

export function Forbidden({
  user,
  resource,
  action,
}: {
  user: Actor;
  resource: string;
  action: string;
}) {
  return (
    <Shell user={user}>
      <Card>
        <h1 className="text-xl font-semibold">403 — not your permission set</h1>
        <p className="mt-2 text-sm text-slate-600">
          {ROLE_LABELS[user.role]} cannot <span className="font-medium">{action}</span>{" "}
          <span className="font-medium">{resource}</span>. Ask an admin if you need it.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-blue-700 hover:underline">
          ← Back to tools
        </Link>
      </Card>
    </Shell>
  );
}
