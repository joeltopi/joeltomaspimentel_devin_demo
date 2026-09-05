import { PERMISSIONS, type Role } from "./roles";

export type Actor = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export class ForbiddenError extends Error {
  constructor(
    public actorRole: Role,
    public resource: string,
    public action: string,
  ) {
    super(`Role "${actorRole}" may not ${action} on "${resource}"`);
    this.name = "ForbiddenError";
  }
}

export function can(user: Actor | null | undefined, resource: string, action: string): boolean {
  if (!user) return false;
  const grants = PERMISSIONS[user.role];
  if (!grants) return false;

  const candidates = [grants["*"], grants[resource]];
  for (const actions of candidates) {
    if (!actions) continue;
    if (actions.includes("*") || actions.includes(action)) return true;
  }
  return false;
}

export function assertCan(user: Actor | null | undefined, resource: string, action: string): void {
  if (!can(user, resource, action)) {
    throw new ForbiddenError(user?.role ?? ("viewer" as Role), resource, action);
  }
}
