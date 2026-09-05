import { registerAppModel } from "@platform/audit/appIndex";
import type { AppSpec } from "@platform/spec";
import { kycReview } from "./kyc-review/spec";

/**
 * The only file that knows every app. Adding an app is one import and one entry
 * here (plus its own folder, Prisma model and permission entries).
 */
// Specs are written against their own row type; the registry and the generic
// routes only ever read them, so widening to the untyped row shape is safe.
export const APPS: AppSpec[] = [kycReview as AppSpec];

for (const app of APPS) registerAppModel(app.model, app.key);

export function getApp(key: string): AppSpec | undefined {
  return APPS.find((app) => app.key === key);
}
