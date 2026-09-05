# Session 3 brief — fraud review app (timed)

## 6. Session 3 — Fraud review app (~25–30 min, timed)

**This session is timed.** Record start and end in `devin/sessions.md`. Start from a fresh session with only this section, the repo, and the instruction: "Follow the conventions in `apps/kyc-review/` and section 3 of the brief."

### 6.1 Model

```prisma
model FraudHeldTransaction {
  id             String   @id @default(cuid())
  customerId     String
  customerName   String
  amount         Decimal  @db.Decimal(12, 2)
  currency       String   @default("USD")
  merchant       String
  channel        String   // card_present | card_not_present | transfer
  riskScore      Int      // 0-100
  riskReasons    String[] // velocity | geo_mismatch | new_device | card_testing | amount_anomaly
  status         String   @default("held") // held | in_review | pending_lead | released | confirmed_fraud
  assigneeId     String?
  assigneeName   String?
  decisionBy     String?
  decisionNote   String?
  heldAt         DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

### 6.2 Spec

- key `fraud-review`, title "Fraud Review", description "Held transactions awaiting human verification".
- columns: customerName, amount (money), merchant, channel, riskScore, riskReasons (chips), status, assigneeName, heldAt.
- fields: all read-only except decisionNote (textarea, editableBy fraud_analyst, fraud_lead).
- statusField `status`; transitions:
  - held → in_review
  - in_review → released | confirmed_fraud | pending_lead
  - pending_lead → released | confirmed_fraud
- filters: status, channel, riskReasons.
- defaultSort riskScore desc.
- constant `HIGH_VALUE_THRESHOLD = 10_000` in spec.ts.

### 6.3 Actions

| key | label | roles | behaviour |
|---|---|---|---|
| claim | Claim | fraud_analyst, fraud_lead | requires held; assign to user; → in_review |
| release | Release | fraud_analyst, fraud_lead | requires in_review (or pending_lead for lead); if amount ≥ threshold and user is not fraud_lead → throw ActionError "High-value: escalate for lead approval"; requiresNote; → released; `payments.release(id)`; if amount ≥ threshold, `slack.postMessage("#fraud-ops", ...)` |
| confirmFraud | Confirm fraud | fraud_analyst, fraud_lead | same threshold rule; requiresNote; → confirmed_fraud; `payments.block(id)`; `payments.flagCustomer(customerId, reasons.join(","))`; slack message always |
| escalate | Escalate to lead | fraud_analyst | requires in_review; requiresNote; → pending_lead; assignee cleared; slack message |
| approveHighValue | (not a button) | fraud_lead | Not a separate action; the lead's `release`/`confirmFraud` on a `pending_lead` row is the approval. Keep the permission key so `can()` documents the rule. |

### 6.4 Seed additions

30 held transactions: amounts from $40 to $48,000 with at least 6 above threshold; risk scores 35–98; 1–3 reasons each; channels mixed; most `held`, three `in_review` assigned to Farid, one `pending_lead`.

### 6.5 Tests

`fraud.test.ts`: every action × every role; threshold rule (analyst release at $9,999 succeeds, at $10,000 fails, lead at $10,000 succeeds); escalate then lead release path; confirmFraud writes audit rows for the update, `payments.block`, `payments.flagCustomer`, and `slack.postMessage`.

### 6.6 Definition of done — Session 3

- Demo path works end to end: as Farid, claim and release a $4,000 transaction; claim a $25,000 one, attempt release, see the threshold error, escalate; as Freya, open the pending_lead row and release it; as Ada, open `/audit` and see the chain across both apps.
- PR diff touches only: `apps/fraud-review/**`, `platform/db/schema.prisma` (one model), `platform/db/seed.ts` (additions), `platform/db/migrations/` (one new migration), `apps/registry.ts` (one line), `platform/permissions/roles.ts` (only if the two fraud roles were not fully defined in Session 1 — they should have been).
- `devin/sessions.md`: start time, end time, elapsed, number of review comments, what they were.

