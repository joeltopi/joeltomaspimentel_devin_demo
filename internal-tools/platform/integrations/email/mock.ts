import { auditIntegrationCall } from "../audit";
import type { EmailIntegration } from "../types";

export const emailMock: EmailIntegration = {
  name: "email",
  async send(to, subject, body) {
    console.log(`[email:mock] to=${to} subject=${subject}`);
    await auditIntegrationCall("email", "send", [to, subject, body]);
  },
};
