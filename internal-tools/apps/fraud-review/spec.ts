import type { AppSpec } from "@platform/spec";
import {
  APP_KEY,
  claim,
  confirmFraud,
  escalate,
  release,
  type FraudTransactionRow,
} from "./actions";

export const FRAUD_STATUSES = [
  "held",
  "in_review",
  "pending_lead",
  "released",
  "confirmed_fraud",
] as const;

export const FRAUD_CHANNELS = ["card_present", "card_not_present", "transfer"] as const;

export const FRAUD_RISK_REASONS = [
  "velocity",
  "geo_mismatch",
  "new_device",
  "card_testing",
  "amount_anomaly",
] as const;

export const FRAUD_FLAG_REASONS = ["new_destination", "high_value"] as const;

const OPEN: string[] = ["held", "in_review", "pending_lead"];

export const fraudReview: AppSpec<FraudTransactionRow> = {
  key: APP_KEY,
  title: "Fraud Review",
  description: "Held transactions awaiting human verification.",
  model: "fraudHeldTransaction",
  columns: [
    { field: "customerName", label: "Customer" },
    { field: "amount", label: "Amount", render: "money" },
    { field: "destination", label: "Destination" },
    { field: "flagReason", label: "Flagged for", render: "status" },
    { field: "merchant", label: "Merchant" },
    { field: "channel", label: "Channel" },
    { field: "riskScore", label: "Risk" },
    { field: "riskReasons", label: "Risk reasons", render: "chips" },
    { field: "status", label: "Status", render: "status" },
    { field: "assigneeName", label: "Assignee" },
    { field: "heldAt", label: "Held", render: "datetime" },
  ],
  fields: [
    { field: "customerName", label: "Customer", type: "text", editableBy: [] },
    { field: "customerId", label: "Customer ID", type: "text", editableBy: [] },
    { field: "amount", label: "Amount", type: "money", editableBy: [] },
    { field: "currency", label: "Currency", type: "text", editableBy: [] },
    { field: "merchant", label: "Merchant", type: "text", editableBy: [] },
    { field: "destination", label: "Destination", type: "text", editableBy: [] },
    {
      field: "destinationKnown",
      label: "Known destination",
      type: "bool",
      editableBy: [],
    },
    { field: "flagReason", label: "Flagged for", type: "text", editableBy: [] },
    { field: "channel", label: "Channel", type: "text", editableBy: [] },
    { field: "riskScore", label: "Risk score", type: "number", editableBy: [] },
    { field: "riskReasons", label: "Risk reasons", type: "json", editableBy: [] },
    {
      field: "decisionNote",
      label: "Decision note",
      type: "textarea",
      editableBy: ["fraud_analyst", "fraud_lead"],
    },
  ],
  statusField: "status",
  transitions: {
    held: ["in_review"],
    in_review: ["released", "confirmed_fraud", "pending_lead"],
    pending_lead: ["released", "confirmed_fraud"],
  },
  actions: [
    {
      key: "claim",
      label: "Claim",
      variant: "primary",
      visibleWhen: (row) => row.status === "held",
      run: (id, user) => claim(id, user),
    },
    {
      key: "release",
      label: "Release",
      variant: "primary",
      requiresNote: true,
      visibleWhen: (row) => OPEN.includes(row.status) && row.status !== "held",
      run: (id, user, input) => release(id, user, input),
    },
    {
      key: "confirmFraud",
      label: "Confirm fraud",
      variant: "danger",
      requiresNote: true,
      visibleWhen: (row) => OPEN.includes(row.status) && row.status !== "held",
      run: (id, user, input) => confirmFraud(id, user, input),
    },
    {
      key: "escalate",
      label: "Escalate to lead",
      requiresNote: true,
      visibleWhen: (row) => row.status === "in_review",
      run: (id, user, input) => escalate(id, user, input),
    },
  ],
  defaultSort: { field: "riskScore", dir: "desc" },
  filters: [
    { field: "status", label: "Status", options: [...FRAUD_STATUSES] },
    { field: "channel", label: "Channel", options: [...FRAUD_CHANNELS] },
    { field: "flagReason", label: "Flagged for", options: [...FRAUD_FLAG_REASONS] },
    {
      field: "riskReasons",
      label: "Risk reason",
      options: [...FRAUD_RISK_REASONS],
      multi: true,
    },
  ],
};
