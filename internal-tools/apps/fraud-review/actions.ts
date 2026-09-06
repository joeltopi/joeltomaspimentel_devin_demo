import { Prisma } from "@prisma/client";
import { db } from "@platform/db/client";
import { getIntegration } from "@platform/integrations";
import { assertCan, type Actor } from "@platform/permissions/can";
import { ActionError } from "@platform/spec";

export const APP_KEY = "fraud-review";

/** The queue's own channel; another app announces to its own without touching the platform. */
export const SLACK_CHANNEL = "#fraud-ops";

/** A transfer to a destination this customer has not paid before is held from here up. */
export const NEW_DESTINATION_THRESHOLD = 1_000;

/** A transfer to a destination the customer has paid before is held from here up. */
export const HIGH_VALUE_THRESHOLD = 10_000;

export type FraudFlagReason = "new_destination" | "high_value";

export type FraudTransactionRow = {
  id: string;
  customerId: string;
  customerName: string;
  amount: Prisma.Decimal;
  currency: string;
  merchant: string;
  destination: string;
  destinationKnown: boolean;
  flagReason: string;
  channel: string;
  riskScore: number;
  riskReasons: string[];
  status: string;
  assigneeId: string | null;
  assigneeName: string | null;
  decisionBy: string | null;
  decisionNote: string | null;
  heldAt: Date;
  updatedAt: Date;
};

/**
 * The rule that puts a transaction in this queue: $1k or more to a destination
 * the customer has never paid, and $10k or more even to one they have.
 * Everything else settles without a human.
 */
export function flagReasonFor(
  amount: number,
  destinationKnown: boolean,
): FraudFlagReason | null {
  if (!destinationKnown && amount >= NEW_DESTINATION_THRESHOLD) return "new_destination";
  if (amount >= HIGH_VALUE_THRESHOLD) return "high_value";
  return null;
}

export function isFlagged(amount: number, destinationKnown: boolean): boolean {
  return flagReasonFor(amount, destinationKnown) !== null;
}

function amountOf(row: FraudTransactionRow): number {
  return Number(row.amount);
}

function isLead(user: Actor): boolean {
  return user.role === "fraud_lead" || user.role === "admin";
}

async function loadTransaction(id: string): Promise<FraudTransactionRow> {
  const row = await db.fraudHeldTransaction.findUnique({ where: { id } });
  if (!row) throw new ActionError("Transaction not found.");
  return row;
}

function requireNote(note: string | undefined): string {
  const trimmed = note?.trim();
  if (!trimmed) throw new ActionError("A decision note is required.");
  return trimmed;
}

/**
 * A lead may decide on anything under review or waiting on them; an analyst
 * only on a transaction in review that they hold, so two analysts cannot decide
 * over each other, and never on one already escalated for lead approval.
 */
function requireDecisionRights(row: FraudTransactionRow, user: Actor): void {
  if (isLead(user)) {
    if (row.status !== "in_review" && row.status !== "pending_lead") {
      throw new ActionError(
        `Transaction must be in review or pending lead approval; it is "${row.status}".`,
      );
    }
    return;
  }

  if (row.status !== "in_review") {
    throw new ActionError(`Transaction must be in review to decide; it is "${row.status}".`);
  }
  if (row.assigneeId !== user.id) {
    throw new ActionError(`Transaction is assigned to ${row.assigneeName ?? "someone else"}.`);
  }
}

/** Money above the threshold is a lead's call, whoever is holding the transaction. */
function requireHighValueRights(row: FraudTransactionRow, user: Actor): void {
  if (amountOf(row) >= HIGH_VALUE_THRESHOLD && !isLead(user)) {
    throw new ActionError("High-value: escalate for lead approval");
  }
}

function decisionGuard(user: Actor): Prisma.FraudHeldTransactionWhereInput {
  return isLead(user)
    ? { status: { in: ["in_review", "pending_lead"] } }
    : { status: "in_review", assigneeId: user.id };
}

/**
 * One atomic write that only lands while the transaction still matches the
 * state the guards were checked against, so two overlapping actions cannot
 * overwrite each other's outcome and the loser leaves no trace.
 */
async function transition(
  id: string,
  expected: Prisma.FraudHeldTransactionWhereInput,
  data: Prisma.FraudHeldTransactionUpdateInput,
): Promise<void> {
  const where = { ...expected, id } as Prisma.FraudHeldTransactionWhereUniqueInput;
  try {
    await db.fraudHeldTransaction.update({ where, data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new ActionError(
        "The transaction changed while you were working on it. Reload and try again.",
      );
    }
    throw error;
  }
}

function money(row: FraudTransactionRow): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: row.currency,
  }).format(amountOf(row));
}

function transactionLabel(row: FraudTransactionRow): string {
  const reasons = row.riskReasons.length > 0 ? ` [${row.riskReasons.join(", ")}]` : "";
  return `${money(row)} ${row.customerName} → ${row.destination}${reasons}`;
}

/**
 * Best effort: the channel post is informational, so a Slack outage must not
 * fail an action whose transition has already committed. The attempt is still
 * in the audit trail either way.
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

  const row = await loadTransaction(id);
  if (row.status !== "held") {
    throw new ActionError(`Only held transactions can be claimed; this one is "${row.status}".`);
  }

  await transition(
    id,
    { status: "held" },
    { status: "in_review", assigneeId: user.id, assigneeName: user.name },
  );
}

export async function release(id: string, user: Actor, input?: { note?: string }): Promise<void> {
  assertCan(user, APP_KEY, "release");

  const note = requireNote(input?.note);
  const row = await loadTransaction(id);
  requireDecisionRights(row, user);
  requireHighValueRights(row, user);

  await transition(id, decisionGuard(user), {
    status: "released",
    decisionBy: user.name,
    decisionNote: note,
  });

  await getIntegration("payments").release(id);

  if (amountOf(row) >= HIGH_VALUE_THRESHOLD) {
    await announce(`${user.name} released ${transactionLabel(row)}. ${note}`);
  }
}

export async function confirmFraud(
  id: string,
  user: Actor,
  input?: { note?: string },
): Promise<void> {
  assertCan(user, APP_KEY, "confirmFraud");

  const note = requireNote(input?.note);
  const row = await loadTransaction(id);
  requireDecisionRights(row, user);
  requireHighValueRights(row, user);

  await transition(id, decisionGuard(user), {
    status: "confirmed_fraud",
    decisionBy: user.name,
    decisionNote: note,
  });

  const payments = getIntegration("payments");
  await payments.block(id);
  await payments.flagCustomer(row.customerId, row.riskReasons.join(","));

  await announce(`${user.name} confirmed fraud on ${transactionLabel(row)}. ${note}`);
}

/** An analyst's way out of a decision they may not make alone: hand it to a lead. */
export async function escalate(id: string, user: Actor, input?: { note?: string }): Promise<void> {
  assertCan(user, APP_KEY, "escalate");

  const note = requireNote(input?.note);
  const row = await loadTransaction(id);
  if (row.status !== "in_review") {
    throw new ActionError(`Only a transaction in review can be escalated; it is "${row.status}".`);
  }
  if (!isLead(user) && row.assigneeId !== user.id) {
    throw new ActionError(`Transaction is assigned to ${row.assigneeName ?? "someone else"}.`);
  }

  await transition(
    id,
    { status: "in_review" },
    {
      status: "pending_lead",
      assigneeId: null,
      assigneeName: null,
      decisionNote: note,
    },
  );

  await announce(`${user.name} escalated ${transactionLabel(row)} for lead approval. ${note}`);
}
