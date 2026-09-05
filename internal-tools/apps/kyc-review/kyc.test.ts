import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerAppModel } from "@platform/audit/appIndex";
import { runWithActor } from "@platform/auth/context";
import { db } from "@platform/db/client";
import { ForbiddenError, type Actor } from "@platform/permissions/can";
import { ROLES, type Role } from "@platform/permissions/roles";
import { ActionError } from "@platform/spec";
import { approve, claim, override, reject, requestInfo, SLACK_CHANNEL } from "./actions";
import { kycReview } from "./spec";

// `apps/registry.ts` does this at import time; the test does not go through it.
registerAppModel(kycReview.model, kycReview.key);

type CaseSeed = {
  status?: string;
  assignee?: Actor | null;
};

const USERS: Record<Role, Actor> = {
  viewer: { id: "u-viewer", name: "Vera Viewer", email: "vera@test", role: "viewer" },
  kyc_analyst: { id: "u-kai", name: "Kai Analyst", email: "kai@test", role: "kyc_analyst" },
  kyc_lead: { id: "u-lena", name: "Lena Lead", email: "lena@test", role: "kyc_lead" },
  fraud_analyst: { id: "u-farid", name: "Farid", email: "farid@test", role: "fraud_analyst" },
  fraud_lead: { id: "u-freya", name: "Freya", email: "freya@test", role: "fraud_lead" },
  admin: { id: "u-ada", name: "Ada Admin", email: "ada@test", role: "admin" },
};

const createdCaseIds: string[] = [];

async function makeCase({ status = "pending", assignee = null }: CaseSeed = {}): Promise<string> {
  const row = await db.kycCase.create({
    data: {
      applicantName: "Test Applicant",
      applicantEmail: `applicant-${Math.random().toString(36).slice(2)}@example.com`,
      country: "PT",
      documentType: "passport",
      documentRef: "DOC-TEST",
      riskFlags: ["pep_match"],
      status,
      assigneeId: assignee?.id ?? null,
      assigneeName: assignee?.name ?? null,
    },
  });
  createdCaseIds.push(row.id);
  return row.id;
}

async function statusOf(id: string): Promise<string> {
  const row = await db.kycCase.findUnique({ where: { id } });
  return String(row?.status);
}

afterEach(async () => {
  const ids = createdCaseIds.splice(0);
  if (ids.length === 0) return;
  await db.kycCase.deleteMany({ where: { id: { in: ids } } });
  await db.auditLog.deleteMany({ where: { recordId: { in: ids } } });
});

describe("permissions: every action against every role", () => {
  const allowed: Record<string, Role[]> = {
    claim: ["kyc_analyst", "kyc_lead", "admin"],
    approve: ["kyc_analyst", "kyc_lead", "admin"],
    reject: ["kyc_analyst", "kyc_lead", "admin"],
    requestInfo: ["kyc_analyst", "kyc_lead", "admin"],
    override: ["kyc_lead", "admin"],
  };

  for (const role of ROLES) {
    it(`enforces the permission map for ${role}`, async () => {
      const user = USERS[role];

      for (const [action, roles] of Object.entries(allowed)) {
        // Each call gets a case in the state its guard expects, so a rejection
        // can only come from permissions, never from a business guard.
        const id = await makeCase(
          action === "claim"
            ? { status: "pending" }
            : { status: "in_review", assignee: user },
        );
        const input = { note: "checked the documents" };

        const run = () =>
          runWithActor(user, async () => {
            switch (action) {
              case "claim":
                return claim(id, user);
              case "approve":
                return approve(id, user, input);
              case "reject":
                return reject(id, user, input);
              case "requestInfo":
                return requestInfo(id, user, input);
              default:
                return override(id, user);
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
  const kai = USERS.kyc_analyst;
  const lena = USERS.kyc_lead;

  it("claims a pending case and assigns it to the caller", async () => {
    const id = await makeCase();
    await runWithActor(kai, () => claim(id, kai));

    const row = await db.kycCase.findUnique({ where: { id } });
    expect(row?.status).toBe("in_review");
    expect(row?.assigneeId).toBe(kai.id);
    expect(row?.assigneeName).toBe(kai.name);
  });

  it("refuses to claim a case that is not pending", async () => {
    const id = await makeCase({ status: "in_review", assignee: kai });
    await expect(runWithActor(kai, () => claim(id, kai))).rejects.toBeInstanceOf(ActionError);
  });

  it("refuses an approval by an analyst who does not hold the case", async () => {
    const id = await makeCase({ status: "in_review", assignee: lena });
    await expect(
      runWithActor(kai, () => approve(id, kai, { note: "looks fine" })),
    ).rejects.toThrow(/assigned to/);
  });

  it("lets a lead decide on a case assigned to someone else", async () => {
    const id = await makeCase({ status: "in_review", assignee: kai });
    await runWithActor(lena, () => approve(id, lena, { note: "spot check passed" }));
    expect(await statusOf(id)).toBe("approved");
  });

  it("requires a note on every decision", async () => {
    const id = await makeCase({ status: "in_review", assignee: kai });
    await expect(runWithActor(kai, () => approve(id, kai, { note: "  " }))).rejects.toThrow(
      /note is required/,
    );
  });

  it("moves a case to info_requested and back to in_review via lead override", async () => {
    const id = await makeCase({ status: "in_review", assignee: kai });
    await runWithActor(kai, () => requestInfo(id, kai, { note: "send a utility bill" }));
    expect(await statusOf(id)).toBe("info_requested");

    await runWithActor(lena, () => override(id, lena));
    const row = await db.kycCase.findUnique({ where: { id } });
    expect(row?.status).toBe("in_review");
    expect(row?.assigneeId).toBe(lena.id);
  });

  it("refuses an info request by an analyst who does not hold the case", async () => {
    const id = await makeCase({ status: "in_review", assignee: lena });
    await expect(
      runWithActor(kai, () => requestInfo(id, kai, { note: "need a bill" })),
    ).rejects.toThrow(/assigned to/);
    expect(await statusOf(id)).toBe("in_review");
  });

  it("does not overwrite a decision made after the guards were checked", async () => {
    const id = await makeCase({ status: "in_review", assignee: kai });
    const first = runWithActor(kai, () => approve(id, kai, { note: "approved first" }));
    const second = runWithActor(lena, () => reject(id, lena, { note: "rejected second" }));

    const outcomes = await Promise.allSettled([first, second]);
    const winners = outcomes.filter((o) => o.status === "fulfilled");
    expect(winners).toHaveLength(1);

    const kaiWon = winners[0] === outcomes[0];
    expect(await statusOf(id)).toBe(kaiWon ? "approved" : "rejected");

    // The losing action must not leave an audit row crediting it with the outcome.
    const updates = await db.auditLog.findMany({
      where: { model: "KycCase", recordId: id, action: "update" },
    });
    expect(updates).toHaveLength(1);
    expect(updates[0].actorId).toBe(kaiWon ? kai.id : lena.id);
  });

  it("refuses a lead override on a decided case", async () => {
    const id = await makeCase({ status: "in_review", assignee: kai });
    await runWithActor(kai, () => reject(id, kai, { note: "document expired" }));
    expect(await statusOf(id)).toBe("rejected");

    await expect(runWithActor(lena, () => override(id, lena))).rejects.toBeInstanceOf(ActionError);
  });
});

describe("audit trail", () => {
  const kai = USERS.kyc_analyst;
  let integrationRowsBefore = 0;

  beforeEach(async () => {
    integrationRowsBefore = await db.auditLog.count({
      where: { action: "integration", recordId: "email" },
    });
  });

  it("writes an update row and an email integration row on approval", async () => {
    const id = await makeCase({ status: "in_review", assignee: kai });
    await runWithActor(kai, () => approve(id, kai, { note: "verified against the register" }));

    const update = await db.auditLog.findFirst({
      where: { model: "KycCase", recordId: id, action: "update" },
      orderBy: { at: "desc" },
    });
    expect(update?.app).toBe("kyc-review");
    expect(update?.actorId).toBe(kai.id);
    expect((update?.before as { status: string }).status).toBe("in_review");
    expect((update?.after as { status: string }).status).toBe("approved");

    const integrationRowsAfter = await db.auditLog.count({
      where: { action: "integration", recordId: "email" },
    });
    expect(integrationRowsAfter).toBe(integrationRowsBefore + 1);
  });

  it("announces the decision to the KYC channel", async () => {
    const id = await makeCase({ status: "in_review", assignee: kai });
    await runWithActor(kai, () => approve(id, kai, { note: "verified against the register" }));

    const post = await db.auditLog.findFirst({
      where: { action: "integration", recordId: "slack" },
      orderBy: { at: "desc" },
    });
    expect(post?.actorId).toBe(kai.id);
    expect(JSON.stringify(post?.meta)).toContain(SLACK_CHANNEL);
  });
});
