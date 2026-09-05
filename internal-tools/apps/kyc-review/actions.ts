import { Prisma } from "@prisma/client";
import { db } from "@platform/db/client";
import { getIntegration } from "@platform/integrations";
import { assertCan, type Actor } from "@platform/permissions/can";
import { ActionError } from "@platform/spec";

export const APP_KEY = "kyc-review";

/** The queue's own channel; another app announces to its own without touching the platform. */
export const SLACK_CHANNEL = "#kyc-ops";

export type KycCaseRow = {
  id: string;
  applicantName: string;
  applicantEmail: string;
  country: string;
  documentType: string;
  documentRef: string;
  riskFlags: string[];
  status: string;
  assigneeId: string | null;
  assigneeName: string | null;
  decisionBy: string | null;
  decisionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
};

async function loadCase(id: string): Promise<KycCaseRow> {
  const row = await db.kycCase.findUnique({ where: { id } });
  if (!row) throw new ActionError("Case not found.");
  return row;
}

function requireNote(note: string | undefined): string {
  const trimmed = note?.trim();
  if (!trimmed) throw new ActionError("A decision note is required.");
  return trimmed;
}

/**
 * A lead may decide on any case in review; an analyst only on cases assigned to
 * them, so two analysts cannot decide over each other.
 */
function requireDecisionRights(row: KycCaseRow, user: Actor): void {
  if (row.status !== "in_review") {
    throw new ActionError(`Case must be in review to decide; it is "${row.status}".`);
  }
  if (isLead(user)) return;
  if (row.assigneeId !== user.id) {
    throw new ActionError(`Case is assigned to ${row.assigneeName ?? "someone else"}.`);
  }
}

function isLead(user: Actor): boolean {
  return user.role === "kyc_lead" || user.role === "admin";
}

function decisionGuard(user: Actor): Prisma.KycCaseWhereInput {
  return isLead(user)
    ? { status: "in_review" }
    : { status: "in_review", assigneeId: user.id };
}

/**
 * One atomic write that only lands while the case still matches the state the
 * guards were checked against, so two overlapping actions cannot overwrite each
 * other's outcome and the loser leaves no trace.
 */
async function transition(
  id: string,
  expected: Prisma.KycCaseWhereInput,
  data: Prisma.KycCaseUpdateInput,
): Promise<void> {
  const where = { ...expected, id } as Prisma.KycCaseWhereUniqueInput;
  try {
    await db.kycCase.update({ where, data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new ActionError("The case changed while you were working on it. Reload and try again.");
    }
    throw error;
  }
}

async function notifyApplicant(row: KycCaseRow, subject: string, body: string): Promise<void> {
  await getIntegration("email").send(row.applicantEmail, subject, body);
}

function caseLabel(row: KycCaseRow): string {
  const flags = row.riskFlags.length > 0 ? ` [${row.riskFlags.join(", ")}]` : "";
  return `${row.applicantName} (${row.country})${flags}`;
}

/**
 * Best effort: the channel post is informational, so a Slack outage must not
 * fail an action whose case transition has already committed. The attempt is
 * still in the audit trail either way.
 */
async function announce(text: string): Promise<void> {
  try {
    await getIntegration("slack").postMessage(SLACK_CHANNEL, text);
  } catch (error) {
    console.error(`[${APP_KEY}] slack announcement failed`, error);
  }
}

export async function claim(id: string, user: Actor): Promise<void> {
  assertCan(user, APP_KEY, "claim");

  const row = await loadCase(id);
  if (row.status !== "pending") {
    throw new ActionError(`Only pending cases can be claimed; this one is "${row.status}".`);
  }

  await transition(
    id,
    { status: "pending" },
    { status: "in_review", assigneeId: user.id, assigneeName: user.name },
  );

  await announce(`${user.name} claimed ${caseLabel(row)}.`);
}

export async function approve(
  id: string,
  user: Actor,
  input?: { note?: string },
): Promise<void> {
  assertCan(user, APP_KEY, "approve");

  const note = requireNote(input?.note);
  const row = await loadCase(id);
  requireDecisionRights(row, user);

  await transition(id, decisionGuard(user), {
    status: "approved",
    decisionBy: user.name,
    decisionNote: note,
  });

  await notifyApplicant(
    row,
    "Your identity verification is approved",
    `Hello ${row.applicantName}, your verification has been approved. ${note}`,
  );

  await announce(`${user.name} approved ${caseLabel(row)}. ${note}`);
}

export async function reject(id: string, user: Actor, input?: { note?: string }): Promise<void> {
  assertCan(user, APP_KEY, "reject");

  const note = requireNote(input?.note);
  const row = await loadCase(id);
  requireDecisionRights(row, user);

  await transition(id, decisionGuard(user), {
    status: "rejected",
    decisionBy: user.name,
    decisionNote: note,
  });

  await notifyApplicant(
    row,
    "Your identity verification could not be completed",
    `Hello ${row.applicantName}, your verification was not approved. ${note}`,
  );

  await announce(`${user.name} rejected ${caseLabel(row)}. ${note}`);
}

export async function requestInfo(
  id: string,
  user: Actor,
  input?: { note?: string },
): Promise<void> {
  assertCan(user, APP_KEY, "requestInfo");

  const note = requireNote(input?.note);
  const row = await loadCase(id);
  requireDecisionRights(row, user);

  await transition(id, decisionGuard(user), {
    status: "info_requested",
    decisionBy: user.name,
    decisionNote: note,
  });

  await notifyApplicant(
    row,
    "We need more information to verify your identity",
    `Hello ${row.applicantName}, we need more from you. ${note}`,
  );

  await announce(`${user.name} asked ${caseLabel(row)} for more information. ${note}`);
}

/** Lets a lead take over a case an analyst is sitting on, before it is decided. */
export async function override(id: string, user: Actor): Promise<void> {
  assertCan(user, APP_KEY, "override");

  const row = await loadCase(id);
  if (row.status === "approved" || row.status === "rejected") {
    throw new ActionError(`Case is already ${row.status} and cannot be reopened.`);
  }

  await transition(
    id,
    { status: { notIn: ["approved", "rejected"] } },
    { status: "in_review", assigneeId: user.id, assigneeName: user.name },
  );

  await announce(`${user.name} took over ${caseLabel(row)} from ${row.assigneeName ?? "the queue"}.`);
}
