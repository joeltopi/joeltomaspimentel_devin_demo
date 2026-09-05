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
