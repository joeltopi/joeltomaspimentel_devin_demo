import { IntegrationError, type PaymentsIntegration } from "../types";

/**
 * Deliberately unimplemented. Talking to a real processor pulls this tool into
 * PCI scope and needs its own security review, so the PoC ships the interface
 * and the mock only.
 */
function notConfigured(): never {
  throw new IntegrationError("payments", "not configured");
}

export const paymentsClient: PaymentsIntegration = {
  name: "payments",
  async release() {
    notConfigured();
  },
  async block() {
    notConfigured();
  },
  async flagCustomer() {
    notConfigured();
  },
};
