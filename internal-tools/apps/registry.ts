import { registerAppModel } from "@platform/audit/appIndex";
import type { AppSpec } from "@platform/spec";

/**
 * The only file that knows every app. Adding an app is one import and one entry
 * here (plus its own folder, Prisma model and permission entries).
 */
export const APPS: AppSpec[] = [];

for (const app of APPS) registerAppModel(app.model, app.key);

export function getApp(key: string): AppSpec | undefined {
  return APPS.find((app) => app.key === key);
}
