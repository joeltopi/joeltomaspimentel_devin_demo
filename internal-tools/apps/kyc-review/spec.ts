import type { AppSpec } from "@platform/spec";
import {
  APP_KEY,
  approve,
  claim,
  override,
  reject,
  requestInfo,
  type KycCaseRow,
} from "./actions";

export const KYC_STATUSES = [
  "pending",
  "in_review",
  "info_requested",
  "approved",
  "rejected",
] as const;

export const KYC_COUNTRIES = ["BR", "DE", "ES", "GB", "NG", "PT", "SG", "US"] as const;

export const KYC_DOCUMENT_TYPES = ["passport", "drivers_license", "national_id"] as const;

const DECIDED: string[] = ["approved", "rejected"];

export const kycReview: AppSpec<KycCaseRow> = {
  key: APP_KEY,
  title: "KYC Review",
  description: "Identity verification cases awaiting a human decision.",
  model: "kycCase",
  columns: [
    { field: "applicantName", label: "Applicant" },
    { field: "country", label: "Country" },
    { field: "documentType", label: "Document" },
    { field: "riskFlags", label: "Risk flags", render: "chips" },
    { field: "status", label: "Status", render: "status" },
    { field: "assigneeName", label: "Assignee" },
    { field: "createdAt", label: "Created", render: "datetime" },
  ],
  fields: [
    { field: "applicantName", label: "Applicant name", type: "text", editableBy: [] },
    { field: "applicantEmail", label: "Applicant email", type: "text", editableBy: [] },
    { field: "country", label: "Country", type: "text", editableBy: [] },
    { field: "documentType", label: "Document type", type: "text", editableBy: [] },
    { field: "documentRef", label: "Document reference", type: "text", editableBy: [] },
    { field: "riskFlags", label: "Risk flags", type: "json", editableBy: [] },
    {
      field: "decisionNote",
      label: "Decision note",
      type: "textarea",
      editableBy: ["kyc_analyst", "kyc_lead"],
    },
  ],
  statusField: "status",
  transitions: {
    pending: ["in_review"],
    in_review: ["approved", "rejected", "info_requested"],
    info_requested: ["in_review"],
  },
  actions: [
    {
      key: "claim",
      label: "Claim",
      variant: "primary",
      visibleWhen: (row) => row.status === "pending",
      run: (id, user) => claim(id, user),
    },
    {
      key: "approve",
      label: "Approve",
      variant: "primary",
      requiresNote: true,
      visibleWhen: (row) => row.status === "in_review",
      run: (id, user, input) => approve(id, user, input),
    },
    {
      key: "reject",
      label: "Reject",
      variant: "danger",
      requiresNote: true,
      visibleWhen: (row) => row.status === "in_review",
      run: (id, user, input) => reject(id, user, input),
    },
    {
      key: "requestInfo",
      label: "Request info",
      requiresNote: true,
      visibleWhen: (row) => row.status === "in_review",
      run: (id, user, input) => requestInfo(id, user, input),
    },
    {
      key: "override",
      label: "Lead override",
      visibleWhen: (row) => !DECIDED.includes(row.status),
      run: (id, user) => override(id, user),
    },
  ],
  defaultSort: { field: "createdAt", dir: "desc" },
  filters: [
    { field: "status", label: "Status", options: [...KYC_STATUSES] },
    { field: "country", label: "Country", options: [...KYC_COUNTRIES] },
  ],
};
