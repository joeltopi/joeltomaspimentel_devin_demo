# Internal tools with Devin — a Power Apps alternative (PoC)

A lightweight proof of concept showing how a small engineering team can build
internal back-office tools **at scale and at low marginal cost** by owning a
thin platform layer and having [Devin](https://devin.ai) build each business
app on top of it. It is a direct answer to the "just use Power Apps" argument:
same speed of delivery, but with real code, real tests, real access control and
an audit trail the team controls.

The claim under test is simple: **the first app costs a platform; every app
after that costs a folder, a spec and one Devin session.**

| | Session | Wall-clock | What shipped |
|---|---|---|---|
| S1 | Platform scaffold | ~30 min | auth, roles, audit, integrations, spec-driven UI, empty portal |
| S2 | KYC review app | ~16 min | one folder, one migration, one registry line; `platform/` untouched |
| S3 | Fraud review app | ~20 min | one folder, one migration, one registry line; one optional flag added to the platform |

Details, decisions and what was cut per session are in
[`internal-tools/devin/sessions.md`](internal-tools/devin/sessions.md).

> This is an architecture sample, **not** a production system: no rate limiting,
> pagination, CSRF review or session hardening, a password-less demo sign-in,
> mocked integrations and no deployment story.

## What it does

A single Next.js deployable serves a portal of internal tools. A user signs in,
sees only the tiles their role allows, and works a queue: list → detail → edit a
few fields → run a guarded action (claim, approve, reject, release, …). Every
write and every outbound integration call is recorded in an audit log that
leads and admins can browse.

Two apps exist today:

- **KYC review** — identity-verification cases automated checks could not clear
  ([`apps/kyc-review/README.md`](internal-tools/apps/kyc-review/README.md)).
- **Fraud review** — held outbound payments awaiting an analyst decision, with
  a high-value lead approval step
  ([`apps/fraud-review/README.md`](internal-tools/apps/fraud-review/README.md)).

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  src/app/            Next.js App Router — generic routes             │
│  /  /login  /tools/[app]  /tools/[app]/[id]  /audit                  │
│  Renders whatever the registry contains; never names an app.         │
├─────────────────────────────────────────────────────────────────────┤
│  apps/registry.ts    the one file that knows every app               │
├───────────────────────────┬─────────────────────────────────────────┤
│  apps/kyc-review/         │  apps/fraud-review/                     │
│  spec · actions · tests   │  spec · actions · tests                 │
│  (imports only @platform) │  (imports only @platform)               │
├───────────────────────────┴─────────────────────────────────────────┤
│  platform/           shared layer, built once                        │
│  auth ─ permissions ─ audit ─ db (Prisma) ─ ui ─ integrations ─ spec │
├─────────────────────────────────────────────────────────────────────┤
│  Postgres 16 (Docker)          Slack / email / payments (mocked)     │
└─────────────────────────────────────────────────────────────────────┘
```

**Platform (`internal-tools/platform/`)** — the part that replaces the licensed
product. Each module maps to a Power Apps capability:

| Module | Stands in for | How |
|---|---|---|
| `auth/` | Entra ID sign-in | Auth.js v5; demo credentials provider, Entra provider enabled by env vars |
| `permissions/` | Security roles, column security | `PERMISSIONS` map per app/action, `can()` / `assertCan()`, `editableBy` per field |
| `audit/` | Dataverse audit | Prisma client extension that records every write, plus every integration call |
| `db/` | Dataverse tables | Prisma schema, migrations and seed; one Postgres database |
| `integrations/` | Connectors | Typed interfaces with a mock and a real client each, selected by `INTEGRATIONS_MODE` |
| `spec.ts` + `ui/` | Canvas / model-driven designer | An `AppSpec` object renders list, filters, detail, form and action bar |

**Apps (`internal-tools/apps/<name>/`)** — a `spec.ts` (columns, fields,
filters, transitions, actions), an `actions.ts` (server functions, each starting
with `assertCan`), a test file covering every action against every role, and a
README. Adding an app also adds its own Prisma model, migration, seed fixtures
and permission entries — the honest cost of a new tool.

**Guardrails** — the isolation rules are ESLint rules, not review comments:
apps import only from `@platform/*`; `process.env` is read only in the two
config files; all writes go through the audited `db` client. See the
[conventions](internal-tools/README.md#conventions).

**Devin's role** — each app is a short brief (`internal-tools/devin/0N-*-brief.md`)
handed to a fresh Devin session, which returns a small PR that a human reviews
against the conventions. Power Automate-style workflows are deliberately not
replicated; actions are plain TypeScript.

## Repo structure

```
.
├── README.md                     ← you are here
└── internal-tools/               the runnable project (Next.js 15, TS, Prisma, Tailwind)
    ├── README.md                 project-level docs: roles, conventions, stubs
    ├── apps/
    │   ├── registry.ts           list of registered apps
    │   ├── kyc-review/           spec.ts · actions.ts · kyc.test.ts · README.md
    │   └── fraud-review/         spec.ts · actions.ts · fraud.test.ts · README.md
    ├── platform/
    │   ├── auth/                 Auth.js config, session helpers, requireUser
    │   ├── permissions/          roles, PERMISSIONS map, can/assertCan
    │   ├── audit/                Prisma audit extension and writer
    │   ├── db/                   schema.prisma, migrations/, seed.ts, clients
    │   ├── integrations/         slack/ email/ payments/ — client + mock each
    │   ├── ui/                   Shell, ResourceTable, ResourceForm, ActionBar, …
    │   └── spec.ts               AppSpec type and ActionError
    ├── src/app/                  Next.js routes (portal, login, tools, audit, auth API)
    ├── devin/                    briefs given to each Devin session + sessions.md log
    ├── docker-compose.yml        Postgres 16 on localhost:5433
    ├── .env.example              copy to .env; defaults work for local use
    └── package.json              scripts listed below
```

## How to run

Prerequisites: Node 20+, npm, Docker.

```bash
cd internal-tools
docker compose up -d      # Postgres 16 on localhost:5433
npm install               # also runs prisma generate
cp .env.example .env
npm run db:migrate        # apply migrations
npm run db:seed           # demo users + fixtures for each app
npm run dev               # http://localhost:3000
```

Open `/login` and pick a seeded user — there is no password. Roles and what each
sees are listed in [`internal-tools/README.md`](internal-tools/README.md#run-it).

Other commands (from `internal-tools/`):

| Command | Purpose |
|---|---|
| `npm test` | Vitest suite; needs Postgres up |
| `npm run lint` | ESLint, including the isolation rules |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | production build |
| `npm run db:reset` | drop, migrate and reseed |

## Adding a third app

1. Write a brief in `internal-tools/devin/` (see `03-fraud-brief.md` for the shape).
2. Start a Devin session with it. The expected PR: `apps/<name>/`, a Prisma
   model and migration, seed fixtures, permission entries, one line in
   `apps/registry.ts`, a session entry in `devin/sessions.md`.
3. Review against the conventions; `npm run lint` catches the structural ones.
