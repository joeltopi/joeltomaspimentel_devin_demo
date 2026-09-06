# Fraud Review

- **Owner:** _(placeholder — assign a team before this leaves the PoC)_
- **App key:** `fraud-review` (URL `/tools/fraud-review`, permission resource `fraud-review`)
- **Model:** `FraudHeldTransaction` in `platform/db/schema.prisma`

## Purpose

The queue of payments the hold rule stopped before they settled. An analyst
claims a transaction, reads the destination, risk score and reasons, and either
releases the money or confirms fraud. Releasing calls `payments.release`;
confirming calls `payments.block` and `payments.flagCustomer` (mocks in this
PoC). Every decision carries a note and lands in the audit log.

## What lands in the queue

```
amount >= $1,000  and the customer has not paid this destination before  → new_destination
amount >= $10,000 and they have                                          → high_value
```

`flagReasonFor(amount, destinationKnown)` in `actions.ts` is that rule; it
returns `null` for anything that should settle without a human. The seed uses
the same rule and refuses to write a fixture the rule would not have held.

`destinationKnown` is a fact the payment stream is expected to carry (has this
customer paid this counterparty before); nothing in this PoC computes it.

## Roles

| Role | Can do |
|---|---|
| `viewer` | read transactions; no action buttons |
| `fraud_analyst` | read, edit the decision note, claim, release, confirm fraud, escalate |
| `fraud_lead` | everything an analyst can, plus decide above the high-value threshold and on escalated transactions, and the audit log |
| `admin` | everything |
| KYC roles | nothing — the tile does not appear |

Permissions live in `platform/permissions/roles.ts`. Hiding a button is a
convenience; the enforcement is `assertCan` as the first statement of every
function in `actions.ts`.

## Statuses and transitions

```
held ──claim──▶ in_review ──release──────▶ released
                    │ ──confirmFraud──▶ confirmed_fraud
                    │ ──escalate───▶ pending_lead ──release / confirmFraud (lead)──▶ decided
```

## Guards

- `claim` requires `held`.
- `release` and `confirmFraud` require a note, and `in_review` for an analyst
  holding the transaction, or `in_review`/`pending_lead` for a lead.
- At or above `HIGH_VALUE_THRESHOLD` ($10,000) an analyst's decision throws
  "High-value: escalate for lead approval"; the lead's decision on the
  `pending_lead` row is the approval, which is what the `approveHighValue`
  permission key documents.
- `escalate` requires `in_review` and a note, and clears the assignee.
- A guard failure throws `ActionError`, whose message is shown in the UI.

## Announcements

`#fraud-ops` gets a message on every confirmed fraud and on releases at or above
the threshold; claims are not announced. The post is best effort — a Slack
outage does not undo a decision that already committed, and the attempt is in
the audit log either way.
