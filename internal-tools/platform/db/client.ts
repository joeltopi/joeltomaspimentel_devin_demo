import { auditExtension } from "@platform/audit/extension";
import { rawDb } from "./raw";

/** Audited client. Every application write goes through this. */
export const db = rawDb.$extends(auditExtension);

export { rawDb };
