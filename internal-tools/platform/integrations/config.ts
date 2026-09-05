/**
 * The only file in the repo that reads environment variables for integrations.
 * Values are never written to audit rows or logs.
 */
export type IntegrationsMode = "mock" | "live";

export function integrationsMode(): IntegrationsMode {
  return process.env.INTEGRATIONS_MODE === "live" ? "live" : "mock";
}

export const integrationConfig = {
  slack: {
    token: () => process.env.SLACK_BOT_TOKEN ?? "",
    defaultChannel: () => process.env.SLACK_DEFAULT_CHANNEL ?? "#internal-tools",
  },
  email: {
    apiKey: () => process.env.EMAIL_API_KEY ?? "",
    from: () => process.env.EMAIL_FROM ?? "no-reply@example.com",
  },
  payments: {
    apiKey: () => process.env.PAYMENTS_API_KEY ?? "",
    baseUrl: () => process.env.PAYMENTS_BASE_URL ?? "",
  },
};
