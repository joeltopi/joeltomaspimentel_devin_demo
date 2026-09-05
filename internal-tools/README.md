# Internal Tools Platform (proof of concept)

A thin, self-owned platform for internal back-office tools: sign-in, roles,
audit, integrations and a generic CRUD-plus-actions UI, built once, with each
business app added as a folder and one line in a registry. It exists to test one
question — can a small engineering team replace a licensed low-code platform
(Power Apps) with a platform they own plus Devin building the apps on top?

It is **not** production-hardened. No rate limiting, no pagination, no CSRF
review, no session hardening, no real payment processor, no deployment story,
demo sign-in with no password. Treat it as an architecture sample, not a system.

## Run it

```bash
docker compose up -d          # Postgres 16 on localhost:5433
npm install
cp .env.example .env
npm run db:migrate            # creates the schema
npm run db:seed               # demo users (+ per-app fixtures)
npm run dev                   # http://localhost:3000
```

Sign in as any seeded user from `/login`; there is no password. Roles:

| User | Role | Sees |
|---|---|---|
| Vera Viewer | viewer | read-only on every app |
| Kai Analyst | kyc_analyst | KYC review |
| Lena Lead | kyc_lead | KYC review + audit log |
| Farid Analyst | fraud_analyst | Fraud review |
| Freya Lead | fraud_lead | Fraud review + audit log |
| Ada Admin | admin | everything |

Other commands: `npm test` (Vitest, needs the database up), `npm run lint`,
`npm run typecheck`, `npm run db:reset`.

## Folders

- `platform/` — the shared layer: auth, permissions, audit, db, ui,
  integrations, and the `AppSpec` type. Built once, changed rarely.
- `apps/` — one folder per business app: a spec, its actions, its tests, its
  README. Apps import only from `@platform/*`.
- `src/app/` — Next.js routes. Generic: they render whatever the registry
  contains and never mention a specific app.
- `devin/` — the briefs each Devin session was given, and `sessions.md`, the log
  of what each session cost and what it cut.

## Conventions

A reviewer checks these on every PR. The first three are enforced by ESLint, so
they fail `npm run lint` rather than waiting for a human.

1. An app imports only from `@platform/*`. Never from another app. Never from
   `src/app`.
2. Every function in an app's `actions.ts` calls `assertCan(user, appKey,
   actionKey)` as its first statement.
3. Every database write goes through `db` from `@platform/db/client`. `rawDb` is
   used only in `platform/db/seed.ts`.
4. No `fetch` to an external host anywhere except inside
   `platform/integrations/*/client.ts`.
5. No `process.env` reads outside `platform/integrations/config.ts` and
   `platform/auth/config.ts`.
6. Prisma models for an app are prefixed with the app's short name (`KycCase`,
   `FraudHeldTransaction`).
7. Registering an app touches one line in `apps/registry.ts`. Nothing else in
   `platform/` or `src/app/` changes — a new app still adds its own Prisma
   model, migration, seed fixtures and permission entries, which is the honest
   cost of adding one.
8. Each app has a test file covering every action against every role.
9. Commit messages reference the session (`[S1]`, `[S2]`, `[S3]`).

## What each platform module stands in for

| Power Apps capability | Here |
|---|---|
| Dataverse tables | Prisma models in `platform/db/schema.prisma`, one Postgres database |
| Entra ID sign-in | `platform/auth/config.ts` — Entra provider, plus a demo credentials provider |
| Security roles, column security | `platform/permissions/` — `PERMISSIONS` map, `can()`, `assertCan()`, `editableBy` per field |
| Dataverse audit | `platform/audit/` — a Prisma extension that audits every write, plus integration calls |
| Connectors (Outlook, Teams, custom) | `platform/integrations/` — typed interfaces with a mock and a real client each |
| Canvas/model-driven app designer | `platform/spec.ts` + `platform/ui/` — a spec object renders list, detail, form and actions |
| Maker portal app list | `src/app/page.tsx` + `apps/registry.ts`, filtered by permissions |
| Power Automate flows | Not replicated. Actions are plain TypeScript functions; there is no workflow engine or designer |

## Stubbed and deferred

- **Microsoft Entra ID SSO** — configured in `platform/auth/config.ts` and
  registered only when `AUTH_MICROSOFT_ENTRA_ID_ID` and
  `AUTH_MICROSOFT_ENTRA_ID_SECRET` are set. Unset in the demo, so the credentials
  provider is used instead. Not tested against a real tenant.
- **Payments integration** — interface and mock only. `payments/client.ts`
  throws `not configured` by design: talking to a real processor pulls this tool
  into PCI scope and needs its own security review, which is not a thing to
  fake in a proof of concept.
- **Slack and email clients** — real implementations exist but are unexercised;
  `INTEGRATIONS_MODE=mock` (the default) keeps every call local and still writes
  the audit row.
- **Refunds and feature-flag apps** — the other two tools in the customer's
  Power Apps estate. Not built.
- **Per-app deployment, mobile, offline, file uploads, a workflow engine** — out
  of scope.

See [`devin/sessions.md`](devin/sessions.md) for what each session cost and what
it cut.
