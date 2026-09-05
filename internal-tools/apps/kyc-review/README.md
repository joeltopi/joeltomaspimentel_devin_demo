# KYC Review

- **Owner:** _(placeholder — assign a team before this leaves the PoC)_
- **App key:** `kyc-review` (URL `/tools/kyc-review`, permission resource `kyc-review`)
- **Model:** `KycCase` in `platform/db/schema.prisma`

## Purpose

A queue of identity verification cases that automated checks could not clear. An
analyst claims a case, reads the applicant details and risk flags, and either
approves it, rejects it, or asks the applicant for more information. Every
decision carries a note and is emailed to the applicant through the `email`
integration (a mock in this PoC).

## Roles

| Role | Can do |
|---|---|
| `viewer` | read cases; no action buttons |
| `kyc_analyst` | read, edit the decision note, claim, approve, reject, request info |
| `kyc_lead` | everything an analyst can, plus lead override, and the audit log |
| `admin` | everything |
| fraud roles | nothing — the tile does not appear |

Permissions live in `platform/permissions/roles.ts`. Hiding a button is a
convenience; the enforcement is `assertCan` as the first statement of every
function in `actions.ts`.

## Statuses and transitions

```
pending ──claim──▶ in_review ──approve──▶ approved
                      │ ──reject───▶ rejected
                      │ ──requestInfo──▶ info_requested ──override──▶ in_review
```

`override` is available to a lead on any case that is not yet approved or
rejected; it reassigns the case to the lead and puts it back in review.

## Guards

- `claim` requires `pending`.
- `approve`, `reject` and `requestInfo` require `in_review` and a note.
- An analyst may only decide on a case assigned to them; a lead (or admin) may
  decide on any case in review.
- A guard failure throws `ActionError`, whose message is shown in the UI.
