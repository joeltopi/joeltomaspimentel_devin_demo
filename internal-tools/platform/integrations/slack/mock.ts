import { auditIntegrationCall } from "../audit";
import type { SlackIntegration } from "../types";

export const slackMock: SlackIntegration = {
  name: "slack",
  async postMessage(channel, text) {
    console.log(`[slack:mock] ${channel} :: ${text}`);
    await auditIntegrationCall("slack", "postMessage", [channel, text]);
  },
};
