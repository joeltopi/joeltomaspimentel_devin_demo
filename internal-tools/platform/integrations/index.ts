import { integrationsMode } from "./config";
import { emailClient } from "./email/client";
import { emailMock } from "./email/mock";
import { paymentsClient } from "./payments/client";
import { paymentsMock } from "./payments/mock";
import { slackClient } from "./slack/client";
import { slackMock } from "./slack/mock";
import type { IntegrationMap, IntegrationName } from "./types";

const MOCKS: IntegrationMap = {
  slack: slackMock,
  email: emailMock,
  payments: paymentsMock,
};

const LIVE: IntegrationMap = {
  slack: slackClient,
  email: emailClient,
  payments: paymentsClient,
};

export function getIntegration<N extends IntegrationName>(name: N): IntegrationMap[N] {
  return integrationsMode() === "live" ? LIVE[name] : MOCKS[name];
}

export * from "./types";
