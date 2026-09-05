export const ROLES = [
  "viewer",
  "kyc_analyst",
  "kyc_lead",
  "fraud_analyst",
  "fraud_lead",
  "admin",
] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export const ROLE_LABELS: Record<Role, string> = {
  viewer: "Viewer",
  kyc_analyst: "KYC Analyst",
  kyc_lead: "KYC Lead",
  fraud_analyst: "Fraud Analyst",
  fraud_lead: "Fraud Lead",
  admin: "Admin",
};

/**
 * resource -> actions. A resource is an app key ("kyc-review") or a platform
 * resource ("audit"). "*" grants everything.
 */
export const PERMISSIONS: Record<Role, Record<string, string[]>> = {
  viewer: {
    "kyc-review": ["read"],
    "fraud-review": ["read"],
  },
  kyc_analyst: {
    "kyc-review": ["read", "update", "claim", "approve", "reject", "requestInfo"],
  },
  kyc_lead: {
    "kyc-review": [
      "read",
      "update",
      "claim",
      "approve",
      "reject",
      "requestInfo",
      "override",
    ],
    audit: ["read"],
  },
  fraud_analyst: {
    "fraud-review": ["read", "update", "claim", "release", "confirmFraud", "escalate"],
  },
  fraud_lead: {
    "fraud-review": [
      "read",
      "update",
      "claim",
      "release",
      "confirmFraud",
      "escalate",
      "approveHighValue",
    ],
    audit: ["read"],
  },
  admin: {
    "*": ["*"],
  },
};
