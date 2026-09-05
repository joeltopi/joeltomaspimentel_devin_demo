# Session 2 brief — KYC review app

## 5. Session 2 — KYC review app (~35 min)

Read `apps/registry.ts`, `platform/spec.ts`, and one of the generic routes before starting. Follow section 3 conventions.

### 5.1 Model

```prisma
model KycCase {
  id              String   @id @default(cuid())
  applicantName   String
  applicantEmail  String
  country         String
  documentType    String   // passport | drivers_license | national_id
  documentRef     String   // fake reference, not a real document
  riskFlags       String[] // e.g. ["pep_match", "address_mismatch"]
  status          String   @default("pending") // pending | in_review | info_requested | approved | rejected
  assigneeId      String?
  assigneeName    String?
  decisionBy      String?
  decisionNote    String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### 5.2 Spec

- key `kyc-review`, title "KYC Review", model `kycCase`.
- columns: applicantName, country, documentType, riskFlags (render as chips), status (status badge), assigneeName, createdAt.
- fields: applicantName, applicantEmail, country, documentType (read-only for all); riskFlags (json, read-only); decisionNote (textarea, editableBy kyc_analyst, kyc_lead).
- statusField `status`; transitions:
  - pending → in_review
  - in_review → approved | rejected | info_requested
  - info_requested → in_review
- filters: status, country.
- defaultSort createdAt desc.

### 5.3 Actions

| key | label | roles | behaviour |
|---|---|---|---|
| claim | Claim | kyc_analyst, kyc_lead | requires status pending; sets assignee to current user; → in_review |
| approve | Approve | kyc_analyst, kyc_lead | requires in_review and assignee == user (lead may override); requiresNote; → approved; email applicant via `email` mock |
| reject | Reject | kyc_analyst, kyc_lead | same guards; requiresNote; → rejected; email applicant |
| requestInfo | Request info | kyc_analyst, kyc_lead | requires in_review; requiresNote; → info_requested; email applicant |
| override | Lead override | kyc_lead | any status except approved/rejected; sets assignee to lead and → in_review |

Each action: `assertCan` first, then load row, then guard, then write via `db`, then integration call. Guard failures throw a typed `ActionError` with a human message shown in the UI.

### 5.4 Seed additions

20 cases: mix of countries, document types, 0–3 risk flags, most `pending`, a few `in_review` assigned to Kai, one `info_requested`.

### 5.5 Tests

`kyc.test.ts`: every action × every role → allowed or `ForbiddenError`; transition guards (claim on non-pending fails, approve by non-assignee analyst fails, lead override succeeds); approve writes an AuditLog row and an integration audit row.

### 5.6 Definition of done — Session 2

- Tile appears for kyc_analyst, kyc_lead, viewer, admin; not for fraud roles.
- As Kai: claim a pending case, approve with a note, see status change; open `/audit` as Lena and see the update plus the email integration row.
- As Vera: no action buttons; direct server action call is forbidden (covered by test).
- `README.md` in the app folder: owner (placeholder), purpose, roles, transitions.
- `devin/sessions.md` updated with timing and any review comments.

