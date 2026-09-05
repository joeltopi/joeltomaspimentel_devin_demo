import { auditIntegrationCall } from "../audit";
import type { PaymentsIntegration } from "../types";

export const paymentsMock: PaymentsIntegration = {
  name: "payments",
  async release(transactionId) {
    console.log(`[payments:mock] release ${transactionId}`);
    await auditIntegrationCall("payments", "release", [transactionId]);
  },
  async block(transactionId) {
    console.log(`[payments:mock] block ${transactionId}`);
    await auditIntegrationCall("payments", "block", [transactionId]);
  },
  async flagCustomer(customerId, reason) {
    console.log(`[payments:mock] flagCustomer ${customerId} (${reason})`);
    await auditIntegrationCall("payments", "flagCustomer", [customerId, reason]);
  },
};
