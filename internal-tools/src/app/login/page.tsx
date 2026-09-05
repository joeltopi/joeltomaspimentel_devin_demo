import { redirect } from "next/navigation";
import { signIn } from "@platform/auth/config";
import { getCurrentUser } from "@platform/auth/session";
import { rawDb } from "@platform/db/raw";
import { isRole, ROLE_LABELS } from "@platform/permissions/roles";
import { Button, Card } from "@platform/ui/primitives";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  const users = await rawDb.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <Card className="w-full max-w-md">
        <h1 className="text-lg font-semibold">Internal Tools</h1>
        <p className="mt-1 text-sm text-slate-600">Sign in as one of the seeded demo users.</p>

        <div className="mt-5 space-y-2">
          {users.map((user) => (
            <form
              key={user.id}
              action={async () => {
                "use server";
                await signIn("demo", { email: user.email, redirectTo: "/" });
              }}
            >
              <Button type="submit" className="w-full text-left">
                <span className="font-medium">{user.name}</span>
                <span className="ml-2 text-slate-500">
                  {isRole(user.role) ? ROLE_LABELS[user.role] : user.role}
                </span>
              </Button>
            </form>
          ))}
          {users.length === 0 ? (
            <p className="text-sm text-red-700">
              No users found. Run <code>npm run db:seed</code>.
            </p>
          ) : null}
        </div>

        <p className="mt-6 text-xs text-slate-400">
          Demo sign-in only: no password is checked. Real deployments use the Microsoft Entra ID
          provider, which is enabled automatically when its environment variables are set.
        </p>
      </Card>
    </div>
  );
}
