import Link from "next/link";
import { APPS } from "@apps/registry";
import { requireUser } from "@platform/auth/session";
import { can } from "@platform/permissions/can";
import { Card } from "@platform/ui/primitives";
import { Shell } from "@platform/ui/Shell";

export default async function PortalPage() {
  const user = await requireUser();
  const apps = APPS.filter((app) => can(user, app.key, "read"));

  return (
    <Shell user={user}>
      <h1 className="mb-1 text-xl font-semibold">Internal tools</h1>
      <p className="mb-6 text-sm text-slate-600">
        Tools you can open with the {user.role.replace(/_/g, " ")} role.
      </p>

      {apps.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">
            No tools are available to your role yet. Apps are registered in
            <code className="mx-1 rounded bg-slate-100 px-1">apps/registry.ts</code>.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <Link key={app.key} href={`/tools/${app.key}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <h2 className="text-sm font-semibold">{app.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{app.description}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </Shell>
  );
}
