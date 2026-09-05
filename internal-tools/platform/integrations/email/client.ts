import { auditIntegrationCall } from "../audit";
import { integrationConfig } from "../config";
import { IntegrationError, type EmailIntegration } from "../types";

export const emailClient: EmailIntegration = {
  name: "email",
  async send(to, subject, body) {
    const apiKey = integrationConfig.email.apiKey();
    if (!apiKey) throw new IntegrationError("email", "EMAIL_API_KEY is not set");

    await auditIntegrationCall("email", "send", [to, subject, body]);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: integrationConfig.email.from(),
        to,
        subject,
        text: body,
      }),
    });
    if (!response.ok) throw new IntegrationError("email", `HTTP ${response.status}`);
  },
};
