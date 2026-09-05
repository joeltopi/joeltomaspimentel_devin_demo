export interface Integration {
  readonly name: string;
}

export class IntegrationError extends Error {
  constructor(
    public integration: string,
    public reason?: unknown,
  ) {
    super(`Integration "${integration}" failed: ${String(reason)}`);
    this.name = "IntegrationError";
  }
}

export interface SlackIntegration extends Integration {
  postMessage(channel: string, text: string): Promise<void>;
}

export interface EmailIntegration extends Integration {
  send(to: string, subject: string, body: string): Promise<void>;
}

export interface PaymentsIntegration extends Integration {
  release(transactionId: string): Promise<void>;
  block(transactionId: string): Promise<void>;
  flagCustomer(customerId: string, reason: string): Promise<void>;
}

export type IntegrationName = "slack" | "email" | "payments";

export type IntegrationMap = {
  slack: SlackIntegration;
  email: EmailIntegration;
  payments: PaymentsIntegration;
};
