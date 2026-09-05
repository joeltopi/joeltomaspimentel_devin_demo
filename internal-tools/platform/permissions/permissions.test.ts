import { describe, expect, it } from "vitest";
import { assertCan, can, ForbiddenError, type Actor } from "./can";
import { ROLES, type Role } from "./roles";

function actor(role: Role): Actor {
  return { id: `id-${role}`, name: role, email: `${role}@example.com`, role };
}

describe("can()", () => {
  it("grants admin everything", () => {
    for (const resource of ["kyc-review", "fraud-review", "audit", "anything"]) {
      expect(can(actor("admin"), resource, "whatever")).toBe(true);
    }
  });

  it("scopes analysts to their own app", () => {
    expect(can(actor("kyc_analyst"), "kyc-review", "approve")).toBe(true);
    expect(can(actor("kyc_analyst"), "fraud-review", "read")).toBe(false);
    expect(can(actor("fraud_analyst"), "fraud-review", "release")).toBe(true);
    expect(can(actor("fraud_analyst"), "kyc-review", "read")).toBe(false);
  });

  it("keeps lead-only actions off analysts", () => {
    expect(can(actor("kyc_analyst"), "kyc-review", "override")).toBe(false);
    expect(can(actor("kyc_lead"), "kyc-review", "override")).toBe(true);
    expect(can(actor("fraud_analyst"), "fraud-review", "approveHighValue")).toBe(false);
    expect(can(actor("fraud_lead"), "fraud-review", "approveHighValue")).toBe(true);
  });

  it("gives viewers read but never write", () => {
    expect(can(actor("viewer"), "kyc-review", "read")).toBe(true);
    expect(can(actor("viewer"), "kyc-review", "update")).toBe(false);
    expect(can(actor("viewer"), "kyc-review", "approve")).toBe(false);
  });

  it("restricts the audit log to admins and leads", () => {
    const allowed: Role[] = ["admin", "kyc_lead", "fraud_lead"];
    for (const role of ROLES) {
      expect(can(actor(role), "audit", "read")).toBe(allowed.includes(role));
    }
  });

  it("denies anonymous callers", () => {
    expect(can(null, "kyc-review", "read")).toBe(false);
  });
});

describe("assertCan()", () => {
  it("throws ForbiddenError when denied", () => {
    expect(() => assertCan(actor("viewer"), "kyc-review", "approve")).toThrow(ForbiddenError);
  });

  it("passes when allowed", () => {
    expect(() => assertCan(actor("kyc_lead"), "kyc-review", "approve")).not.toThrow();
  });
});
