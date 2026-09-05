import type { Prisma } from "@prisma/client";
import { writeAudit } from "@platform/audit/write";
import { integrationsMode } from "./config";
import type { IntegrationName } from "./types";

/**
 * Records one integration call. Arguments are recorded because they are
 * business facts (channel, recipient, transaction id); credentials live only in
 * `config.ts` and never reach this function.
 */
export async function auditIntegrationCall(
  integration: IntegrationName,
  method: string,
  args: unknown[],
): Promise<void> {
  const meta = {
    integration,
    method,
    mode: integrationsMode(),
    args: JSON.parse(JSON.stringify(args)),
  } as Prisma.InputJsonValue;

  await writeAudit({
    model: "Integration",
    recordId: integration,
    action: "integration",
    meta,
  });
}
