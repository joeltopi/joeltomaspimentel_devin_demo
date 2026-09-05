/**
 * Maps a Prisma model name to the app that owns it, so audit rows can be
 * filtered per app. Populated by `apps/registry.ts` at import time; the audit
 * layer must not import the registry, or platform would depend on apps.
 */
const modelToApp = new Map<string, string>();

export function registerAppModel(model: string, appKey: string): void {
  modelToApp.set(model.toLowerCase(), appKey);
}

export function appForModel(model: string): string | null {
  return modelToApp.get(model.toLowerCase()) ?? null;
}
