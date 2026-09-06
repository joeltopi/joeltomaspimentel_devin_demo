# Session log

One entry per Devin session. The point of this file is to make the cost of each
app visible: how long it took, how much review it needed, what was cut.

## Session 1 — Platform scaffold and portal

- Session: https://app.devin.ai/sessions/6d4cbb0b1bfd4a8785d3de582a27bbaf
- Brief: `devin/01-scaffold-brief.md`
- Start: 2026-09-05 16:45 UTC
- End: 2026-09-05 17:15 UTC
- Elapsed: ~30 min
- Review comments: (fill in after review)

### What shipped

Auth (Auth.js, demo credentials + Entra provider behind env vars), role
permissions, an audit layer implemented as a Prisma client extension, three
integration interfaces with mocks, the `AppSpec` type, and the generic
portal/list/detail/audit routes. `apps/registry.ts` is empty, so the portal
renders an empty grid — session 2 adds the first app.

### Decisions

- **Project lives in `internal-tools/`, not the repo root.** The repo also holds
  the write-ups for this evaluation.
- **Postgres is published on host port 5433**, not 5432, so it does not collide
  with a local Postgres.
- **`platform/db/raw.ts` holds the unaudited client**, separate from
  `client.ts`, to break the import cycle client → audit extension → audit writer
  → client.
- **Model→app mapping is a registration call, not an import.** The audit layer
  cannot import `apps/registry.ts` without platform depending on apps, so
  `registry.ts` calls `registerAppModel()` at import time.
- **Conventions are ESLint rules, not review comments.** `process.env` outside
  the two config files, an app importing another app or `src/`, and an app
  importing `rawDb` all fail `npm run lint`.
- **`writeAudit` logs and swallows its own failures.** Losing a business write
  because the audit sink is down is worse than a gap in the trail; a production
  build would ship the trail to an append-only store and alert on gaps.

### Cut

- No `middleware.ts` route protection. Enforcement is `requireUser` +
  `assertCan` in every page and action, which is the layer that matters; a
  middleware pass would be defence in depth.
- No pagination or search on list views (hard cap of 200 rows).
- Audit `before`/`after` diffing is a simple field comparison, not a real diff.

## Session 2 — KYC review app

- Session: https://app.devin.ai/sessions/c5d8731e0e2a41a2b4b38a21e265c60b
- Brief: `devin/02-kyc-brief.md`
- Start: 2026-09-05 20:19 UTC
- End: 2026-09-05 20:35 UTC
- Elapsed: ~16 min
- Review comments: (fill in after review)

### What shipped

`KycCase` model and migration, `apps/kyc-review/` (spec, actions, tests,
README), one registry line, and 20 seeded cases. Nothing in `platform/` or
`src/app/` changed, which was the point of the exercise: the second app is a
folder plus a line.

### Decisions

- **An analyst may only decide on a case assigned to them; a lead may decide on
  any case in review.** The brief's "lead may override" is read as the lead's
  decision rights, on top of the explicit `override` action that reassigns.
- **Guards live in `actions.ts`, not in the spec's `visibleWhen`.** `visibleWhen`
  only hides buttons that cannot apply in the current status; every rule is
  re-checked server-side, so a hand-crafted action call fails the same way.
- **The registry widens the spec's row type with one cast.** Specs are written
  against their own row type for field-name checking, and `AppSpec<KycCaseRow>`
  is not assignable to `AppSpec<Row>` because `visibleWhen` takes the row. The
  alternative — untyped specs — loses the checking that matters when writing an
  app.
- **The test registers its own model→app mapping.** `apps/registry.ts` does this
  at import time, and an app must not import the registry.

### Cut

- No transition enforcement in the generic layer: `spec.transitions` documents
  the state machine and the actions enforce it. A platform-level check that
  every action's target status is a declared transition would be better.
- Risk flags are a plain string array with no vocabulary; a real system would
  key them to a checks provider.

## Session 3 — Fraud review app

- Session: https://app.devin.ai/sessions/5d36a06c57a24d05adadf9837e4bec1d
- Brief: `devin/03-fraud-brief.md`
- Start: 2026-09-06 10:06 UTC
- End: 2026-09-06 10:25 UTC
- Elapsed: ~20 min
- Review comments: (fill in after review)

### What shipped

`FraudHeldTransaction` model and migration, `apps/fraud-review/` (spec, actions,
tests, README), one registry line, and 31 seeded held transactions. The only
platform change is an optional `multi` flag on `FilterSpec`, so a list-valued
column can be filtered.

### Decisions

- **The hold rule is code, not a comment.** `flagReasonFor(amount,
  destinationKnown)` returns `new_destination` above $1,000 to a destination the
  customer has not paid, `high_value` above $10,000 to one they have, and `null`
  otherwise. The model stores `destination`, `destinationKnown` and the resulting
  `flagReason` so an analyst sees why a payment was stopped, and the seed refuses
  a fixture the rule would not have held.
- **The brief's "$40 to $48,000" seed range was not used.** Under the hold rule
  a $40 payment never reaches this queue; fixtures start just above $1,000.
- **Filtering a `String[]` column needed one platform line.** `FilterSpec.multi`
  makes the generic list query use `{ has: value }`, which is the smallest
  generic thing that supports the brief's `riskReasons` filter.
- **A release below the threshold is not announced.** Only confirmed fraud and
  high-value releases post to `#fraud-ops`; announcing every release would make
  the channel unreadable.
- **The lead's decision on a `pending_lead` row is the high-value approval.**
  There is no `approveHighValue` action; the permission key documents the rule.

### Cut

- Nothing recomputes `destinationKnown` or the hold decision — it arrives with
  the transaction. A real system holds the payment at the processor.
- No four-eyes rule beyond the threshold, no SLA or ageing on the queue, no bulk
  actions.
