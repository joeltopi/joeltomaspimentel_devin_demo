import { afterEach, describe, expect, it } from "vitest";
import { runWithActor } from "@platform/auth/context";
import { db } from "@platform/db/client";
import { rawDb } from "@platform/db/raw";
import { getIntegration } from "@platform/integrations";
import type { Actor } from "@platform/permissions/can";

const actor: Actor = {
  id: "test-actor",
  name: "Test Actor",
  email: "test-actor@example.com",
  role: "kyc_lead",
};

const createdEmails: string[] = [];

afterEach(async () => {
  for (const email of createdEmails.splice(0)) {
    await rawDb.user.deleteMany({ where: { email } });
  }
});

async function seedUser(): Promise<{ id: string; email: string }> {
  const email = `audit-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  createdEmails.push(email);
  const user = await rawDb.user.create({
    data: { name: "Before Name", email, role: "viewer" },
  });
  return { id: user.id, email };
}

describe("audit extension", () => {
  it("records an update with actor, before and after", async () => {
    const user = await seedUser();

    await runWithActor(actor, async () => {
      await db.user.update({ where: { id: user.id }, data: { name: "After Name" } });
    });

    const entry = await rawDb.auditLog.findFirst({
      where: { model: "User", recordId: user.id, action: "update" },
      orderBy: { at: "desc" },
    });

    expect(entry).not.toBeNull();
    expect(entry?.actorId).toBe(actor.id);
    expect(entry?.actorName).toBe(actor.name);
    expect(entry?.actorRole).toBe(actor.role);
    expect((entry?.before as { name: string }).name).toBe("Before Name");
    expect((entry?.after as { name: string }).name).toBe("After Name");
  });

  it("attributes writes with no ambient actor to system", async () => {
    const user = await seedUser();
    await db.user.update({ where: { id: user.id }, data: { name: "System Edit" } });

    const entry = await rawDb.auditLog.findFirst({
      where: { model: "User", recordId: user.id, action: "update" },
      orderBy: { at: "desc" },
    });

    expect(entry?.actorName).toBe("system");
  });

  it("does not audit writes made through rawDb", async () => {
    const user = await seedUser();
    const before = await rawDb.auditLog.count({ where: { recordId: user.id } });
    await rawDb.user.update({ where: { id: user.id }, data: { name: "Seeded" } });
    const after = await rawDb.auditLog.count({ where: { recordId: user.id } });

    expect(after).toBe(before);
  });
});

describe("integrations", () => {
  it("audits a mock slack call with the actor and arguments", async () => {
    await runWithActor(actor, async () => {
      await getIntegration("slack").postMessage("#fraud-ops", "hello from the test");
    });

    const entry = await rawDb.auditLog.findFirst({
      where: { action: "integration", recordId: "slack" },
      orderBy: { at: "desc" },
    });

    expect(entry?.actorName).toBe(actor.name);
    expect(entry?.meta).toMatchObject({
      integration: "slack",
      method: "postMessage",
      mode: "mock",
      args: ["#fraud-ops", "hello from the test"],
    });
  });

  it("refuses to talk to a real payment processor", async () => {
    const { paymentsClient } = await import("@platform/integrations/payments/client");
    await expect(paymentsClient.release("tx_1")).rejects.toThrow("not configured");
  });
});
