import { auditIntegrationCall } from "../audit";
import { integrationConfig } from "../config";
import { IntegrationError, type SlackIntegration } from "../types";

export const slackClient: SlackIntegration = {
  name: "slack",
  async postMessage(channel, text) {
    // Audited before anything can fail, so a misconfigured deployment still
    // leaves a record of what an app tried to send.
    await auditIntegrationCall("slack", "postMessage", [channel, text]);

    const token = integrationConfig.slack.token();
    if (!token) throw new IntegrationError("slack", "SLACK_BOT_TOKEN is not set");

    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ channel, text }),
    });
    if (!response.ok) throw new IntegrationError("slack", `HTTP ${response.status}`);
  },
};
