import Link from "next/link";
import type { ReactNode } from "react";
import { APPS } from "@apps/registry";
import type { Actor } from "@platform/permissions/can";
import { can } from "@platform/permissions/can";
import { ROLE_LABELS } from "@platform/permissions/roles";
import { SignOutButton } from "./SignOutButton";

export function Shell({ user, children }: { user: Actor; children: ReactNode }) {
  const apps = APPS.filter((app) => can(user, app.key, "read"));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <Link href="/" className="text-sm font-semibold">
            Internal Tools
          </Link>
          <nav className="flex flex-1 gap-4 text-sm">
            {apps.map((app) => (
              <Link key={app.key} href={`/tools/${app.key}`} className="text-slate-600 hover:text-slate-900">
                {app.title}
              </Link>
            ))}
            {can(user, "audit", "read") ? (
              <Link href="/audit" className="text-slate-600 hover:text-slate-900">
                Audit log
              </Link>
            ) : null}
          </nav>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>
              {user.name} · {ROLE_LABELS[user.role]}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
