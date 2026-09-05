import { redirect } from "next/navigation";
import { auth } from "./config";
import type { Actor } from "@platform/permissions/can";
import { isRole } from "@platform/permissions/roles";

export async function getCurrentUser(): Promise<Actor | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.email || !isRole(String(user.role))) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

/** Redirects to the login page when there is no session. */
export async function requireUser(): Promise<Actor> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
