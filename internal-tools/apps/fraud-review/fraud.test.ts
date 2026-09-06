import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerAppModel } from "@platform/audit/appIndex";
import { runWithActor } from "@platform/auth/context";
import { db } from "@platform/db/client";
import { slackMock } from "@platform/integrations/slack/mock";
import { ForbiddenError, type Actor } from "@platform/permissions/can";
import { ROLES, type Role } from "@platform/permissions/roles";
import { ActionError } from "@platform/spec";
import {
  claim,
  confirmFraud,
  escalate,
  flagReasonFor,
  HIGH_VALUE_THRESHOLD,
  isFlagged,
  NEW_DESTINATION_THRESHOLD,
  release,
  SLACK_CHANNEL,
} from "./actions";
import { fraudReview } from "./spec";

// `apps/registry.ts` does this at import time; the test does not go through it.
registerAppModel(fraudReview.model, fraudReview.key);

type TransactionSeed = {
  amount?: number;
  destinationKnown?: boolean;
  status?: string;
  assignee?: Actor | null;
};

const USERS: Record<Role, Actor> = {
  viewer: { id: "u-viewer", name: "Vera Viewer", email: "vera@test", role: "viewer" },
  kyc_analyst: { id: "u-kai", name: "Kai Analyst", email: "kai@test", role: "kyc_analyst" },
  kyc_lead: { id: "u-lena", name: "Lena Lead", email: "lena@test", role: "kyc_lead" },
  fraud_analyst: { id: "u-farid", name: "Farid Analyst", email: "farid@test", role: "fraud_analyst" },
  fraud_lead: { id: "u-freya", name: "Freya Lead", email: "freya@test", role: "fraud_lead" },
  admin: { id: "u-ada", name: "Ada Admin", email: "ada@test", role: "admin" },
};

const createdIds: string[] = [];

async function makeTransaction({
  amount = 4_000,
  destinationKnown = false,
  status = "held",
  assignee = null,
}: TransactionSeed = {}): Promise<string> {
  const customerId = `CUST-TEST-${Math.random().toString(36).slice(2)}`;
  const row = await db.fraudHeldTransaction.create({
    data: {
      customerId,
      customerName: "Test Customer",
      amount,
      merchant: "Test Merchant",
      destination: "Test Destination",
      destinationKnown,
      flagReason: flagReasonFor(amount, destinationKnown) ?? "new_destination",
      channel: "transfer",
      riskScore: 70,
      riskReasons: ["velocity", "new_device"],
      status,
      assigneeId: assignee?.id ?? null,
      assigneeName: assignee?.name ?? null,
    },
  });
  createdIds.push(row.id);
  return row.id;
}

async function statusOf(id: string): Promise<string> {
  const row = await db.fraudHeldTransaction.findUnique({ where: { id } });
  return String(row?.status);
}

afterEach(async () => {
  const ids = createdIds.splice(0);
  if (ids.length === 0) return;
  await db.fraudHeldTransaction.deleteMany({ where: { id: { in: ids } } });
  await db.auditLog.deleteMany({ where: { recordId: { in: ids } } });
});

describe("hold rule", () => {
  it("holds $1,000 or more to a destination the customer has not paid", () => {
    expect(flagReasonFor(NEW_DESTINATION_THRESHOLD, false)).toBe("new_destination");
    expect(flagReasonFor(NEW_DESTINATION_THRESHOLD + 0.01, false)).toBe("new_destination");
    expect(flagReasonFor(25_000, false)).toBe("new_destination");
  });

  it("lets a smaller payment to a new destination settle", () => {
    expect(flagReasonFor(NEW_DESTINATION_THRESHOLD - 0.01, false)).toBeNull();
    expect(isFlagged(999, false)).toBe(false);
  });

  it("holds a known destination from $10,000 up", () => {
    expect(flagReasonFor(HIGH_VALUE_THRESHOLD, true)).toBe("high_value");
    expect(flagReasonFor(HIGH_VALUE_THRESHOLD - 0.01, true)).toBeNull();
    expect(isFlagged(9_500, true)).toBe(false);
  });
});

describe("permissions: every action against every role", () => {
  const allowed: Record<string, Role[]> = {
    claim: ["fraud_analyst", "fraud_lead", "admin"],
    release: ["fraud_analyst", "fraud_lead", "admin"],
    confirmFraud: ["fraud_analyst", "fraud_lead", "admin"],
    escalate: ["fraud_analyst", "fraud_lead", "admin"],
  };

  for (const role of ROLES) {
    it(`enforces the permission map for ${role}`, async () => {
      const user = USERS[role];

      for (const [action, roles] of Object.entries(allowed)) {
        // Each call gets a transaction in the state its guard expects, and
        // below the threshold, so a rejection can only come from permissions.
        const id = await makeTransaction(
          action === "claim"
            ? { status: "held" }
            : { status: "in_review", assignee: user, amount: 4_000 },
        );
        const input = { note: "reviewed the device history" };

        const run = () =>
          runWithActor(user, async () => {
            switch (action) {
              case "claim":
                return claim(id, user);
              case "release":
                return release(id, user, input);
              case "confirmFraud":
                return confirmFraud(id, user, input);
              default:
                return escalate(id, user, input);
            }
          });

        if (roles.includes(role)) {
          await expect(run()).resolves.toBeUndefined();
        } else {
          await expect(run()).rejects.toBeInstanceOf(ForbiddenError);
        }
      }
    });
  }
});

describe("transition guards", () => {
  const farid = USERS.fraud_analyst;
  const freya = USERS.fraud_lead;

  it("claims a held transaction and assigns it to the caller", async () => {
    const id = await makeTransaction();
    await runWithActor(farid, () => claim(id, farid));

    const row = await db.fraudHeldTransaction.findUnique({ where: { id } });
    expect(row?.status).toBe("in_review");
    expect(row?.assigneeId).toBe(farid.id);
    expect(row?.assigneeName).toBe(farid.name);
  });

  it("refuses to claim a transaction that is not held", async () => {
    const id = await makeTransaction({ status: "in_review", assignee: farid });
    await expect(runWithActor(farid, () => claim(id, farid))).rejects.toBeInstanceOf(ActionError);
  });

  it("refuses a release by an analyst who does not hold the transaction", async () => {
    const id = await makeTransaction({ status: "in_review", assignee: freya });
    await expect(
      runWithActor(farid, () => release(id, farid, { note: "looks legitimate" })),
    ).rejects.toThrow(/assigned to/);
  });

  it("requires a note on every decision", async () => {
    const id = await makeTransaction({ status: "in_review", assignee: farid });
    await expect(runWithActor(farid, () => release(id, farid, { note: " " }))).rejects.toThrow(
      /note is required/,
    );
  });

  it("does not overwrite a decision made after the guards were checked", async () => {
    const id = await makeTransaction({ status: "in_review", assignee: farid });
    const first = runWithActor(farid, () => release(id, farid, { note: "released first" }));
    const second = runWithActor(freya, () =>
      confirmFraud(id, freya, { note: "confirmed second" }),
    );

    const outcomes = await Promise.allSettled([first, second]);
    const winners = outcomes.filter((outcome) => outcome.status === "fulfilled");
    expect(winners).toHaveLength(1);

    const faridWon = winners[0] === outcomes[0];
    expect(await statusOf(id)).toBe(faridWon ? "released" : "confirmed_fraud");

    const updates = await db.auditLog.findMany({
      where: { model: "FraudHeldTransaction", recordId: id, action: "update" },
    });
    expect(updates).toHaveLength(1);
    expect(updates[0].actorId).toBe(faridWon ? farid.id : freya.id);
  });
});

describe("high-value threshold", () => {
  const farid = USERS.fraud_analyst;
  const freya = USERS.fraud_lead;

  it("lets an analyst release just under the threshold", async () => {
    const id = await makeTransaction({ status: "in_review", assignee: farid, amount: 9_999 });
    await runWithActor(farid, () => release(id, farid, { note: "known payroll run" }));
    expect(await statusOf(id)).toBe("released");
  });

  it("stops an analyst at the threshold", async () => {
    const id = await makeTransaction({
      status: "in_review",
      assignee: farid,
      amount: HIGH_VALUE_THRESHOLD,
      destinationKnown: true,
    });
    await expect(
      runWithActor(farid, () => release(id, farid, { note: "customer confirmed" })),
    ).rejects.toThrow(/escalate for lead approval/);
    expect(await statusOf(id)).toBe("in_review");
  });

  it("stops an analyst confirming fraud at the threshold", async () => {
    const id = await makeTransaction({
      status: "in_review",
      assignee: farid,
      amount: 25_000,
    });
    await expect(
      runWithActor(farid, () => confirmFraud(id, farid, { note: "card testing pattern" })),
    ).rejects.toThrow(/escalate for lead approval/);
  });

  it("lets a lead release at the threshold", async () => {
    const id = await makeTransaction({
      status: "in_review",
      assignee: farid,
      amount: HIGH_VALUE_THRESHOLD,
      destinationKnown: true,
    });
    await runWithActor(freya, () => release(id, freya, { note: "spoke to the customer" }));
    expect(await statusOf(id)).toBe("released");
  });

  it("escalates to a lead who then releases the transaction", async () => {
    const id = await makeTransaction({ status: "in_review", assignee: farid, amount: 25_000 });
    await runWithActor(farid, () => escalate(id, farid, { note: "over my limit" }));

    const escalated = await db.fraudHeldTransaction.findUniqueOrThrow({ where: { id } });
    expect(escalated.status).toBe("pending_lead");
    expect(escalated.assigneeId).toBeNull();

    await runWithActor(freya, () => release(id, freya, { note: "verified with the customer" }));
    const released = await db.fraudHeldTransaction.findUniqueOrThrow({ where: { id } });
    expect(released.status).toBe("released");
    expect(released.decisionBy).toBe(freya.name);
  });

  it("keeps an analyst out of a transaction already escalated", async () => {
    const id = await makeTransaction({ status: "pending_lead", amount: 25_000 });
    await expect(
      runWithActor(farid, () => release(id, farid, { note: "changed my mind" })),
    ).rejects.toThrow(/must be in review/);
  });
});

describe("audit trail", () => {
  const farid = USERS.fraud_analyst;
  let paymentRowsBefore = 0;

  beforeEach(async () => {
    paymentRowsBefore = await db.auditLog.count({
      where: { action: "integration", recordId: "payments" },
    });
  });

  it("records the update, both payment calls and the announcement on confirmed fraud", async () => {
    const id = await makeTransaction({ status: "in_review", assignee: farid, amount: 4_000 });
    await runWithActor(farid, () => confirmFraud(id, farid, { note: "device seen on 9 cards" }));

    const update = await db.auditLog.findFirst({
      where: { model: "FraudHeldTransaction", recordId: id, action: "update" },
      orderBy: { at: "desc" },
    });
    expect(update?.app).toBe("fraud-review");
    expect(update?.actorId).toBe(farid.id);
    expect((update?.before as { status: string }).status).toBe("in_review");
    expect((update?.after as { status: string }).status).toBe("confirmed_fraud");

    const payments = await db.auditLog.findMany({
      where: { action: "integration", recordId: "payments" },
      orderBy: { at: "desc" },
      take: 2,
    });
    expect(await db.auditLog.count({ where: { action: "integration", recordId: "payments" } })).toBe(
      paymentRowsBefore + 2,
    );
    const methods = payments.map((row) => (row.meta as { method: string }).method);
    expect(methods).toContain("block");
    expect(methods).toContain("flagCustomer");

    const post = await db.auditLog.findFirst({
      where: { action: "integration", recordId: "slack" },
      orderBy: { at: "desc" },
    });
    expect(JSON.stringify(post?.meta)).toContain(SLACK_CHANNEL);
  });

  it("releases through the payments integration", async () => {
    const id = await makeTransaction({ status: "in_review", assignee: farid, amount: 4_000 });
    await runWithActor(farid, () => release(id, farid, { note: "customer confirmed the purchase" }));

    const call = await db.auditLog.findFirst({
      where: { action: "integration", recordId: "payments" },
      orderBy: { at: "desc" },
    });
    expect((call?.meta as { method: string }).method).toBe("release");
    expect(JSON.stringify(call?.meta)).toContain(id);
  });

  it("keeps the decision when the announcement fails", async () => {
    const post = vi.spyOn(slackMock, "postMessage").mockRejectedValue(new Error("slack is down"));
    const id = await makeTransaction({ status: "in_review", assignee: farid, amount: 4_000 });

    try {
      await runWithActor(farid, () => confirmFraud(id, farid, { note: "clear card testing" }));
    } finally {
      post.mockRestore();
    }

    expect(await statusOf(id)).toBe("confirmed_fraud");
  });
});
