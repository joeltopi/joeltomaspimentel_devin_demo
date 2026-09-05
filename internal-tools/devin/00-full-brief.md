# Internal Tools Platform — Devin Build Brief

This document is the complete specification for a proof-of-concept internal tools platform. It is split into three Devin sessions. Each session has its own definition of done. Do not start a session until the previous one is merged.

Time budget for all three sessions combined: ~2 hours of Devin wall-clock. If a session is running long, stop adding scope and finish what works. Note anything cut in `devin/sessions.md`.

---

## 0. Context and goals

A fintech company runs three internal tools on Microsoft Power Apps (a KYC review queue, a refunds dashboard, a feature-flag admin panel) and plans to build ten more. This PoC tests whether a thin, self-owned platform plus Devin can replace that, with the security properties a fintech needs.

The PoC must demonstrate three things:

1. A shared platform layer (auth, permissions, audit, integrations, UI) built once.
2. Two business apps built on it from short specs, isolated from each other.
3. That app #2 is cheap: a fresh Devin session, a spec, a small PR.

It is a web app, runnable locally from the repo in five commands. It is not production-hardened, and the README must say so.

---

## 1. Stack and constraints

- Next.js (App Router), TypeScript, React, Tailwind. Single deployable.
- Postgres via Docker Compose for local dev. Prisma as ORM, with schema, migrations, and seed living in `platform/db/` (set `schema` in `prisma.config.ts`).
- Auth.js (next-auth v5) with a Credentials provider for the demo and a Microsoft Entra ID provider configured but disabled unless env vars are present.
- npm, not pnpm. No monorepo tooling.
- Vitest for tests.
- No external network calls in dev or test. All integrations use mocks selected by env.
- No secrets in source. Secrets are read from env in exactly one place (`platform/integrations/config.ts`).

Non-goals for this PoC: mobile, file uploads, workflow engine, real payment processor, per-app deployments, refunds and feature-flag apps.

---

## 2. Repository structure

```
internal-tools/
├── README.md
├── docker-compose.yml           # Postgres 16 only
├── .env.example
├── package.json                 # scripts: dev, build, test, db:migrate, db:seed, db:reset
├── prisma.config.ts             # points Prisma at platform/db/schema.prisma
├── tsconfig.json                # paths: @platform/*, @apps/*
├── apps/                        # one folder per business app
│   ├── registry.ts              # the only file that knows every app
│   ├── kyc-review/
│   │   ├── spec.ts
│   │   ├── actions.ts
│   │   ├── kyc.test.ts
│   │   └── README.md
│   └── fraud-review/
│       ├── spec.ts
│       ├── actions.ts
│       ├── fraud.test.ts
│       └── README.md
├── platform/                    # shared layer, built once
│   ├── auth/
│   │   ├── config.ts            # Auth.js setup, providers
│   │   ├── session.ts           # getCurrentUser(), requireUser()
│   │   └── context.ts           # AsyncLocalStorage for actor propagation
│   ├── permissions/
│   │   ├── roles.ts             # Role union, role definitions
│   │   ├── can.ts               # can(), assertCan(), ForbiddenError
│   │   └── permissions.test.ts
│   ├── audit/
│   │   ├── write.ts             # writeAudit()
│   │   └── extension.ts         # Prisma $extends hooking create/update/delete
│   ├── db/
│   │   ├── schema.prisma        # all models; grouped by app with a comment header per app
│   │   ├── seed.ts              # demo users + per-app fixtures
│   │   ├── migrations/
│   │   └── client.ts            # exports `db` (audited) and `rawDb` (unaudited, seed only)
│   ├── ui/
│   │   ├── Shell.tsx            # nav from registry, filtered by permissions
│   │   ├── ResourceTable.tsx    # list view from spec.columns
│   │   ├── ResourceForm.tsx     # detail/edit view from spec.fields
│   │   ├── ActionBar.tsx        # buttons from spec.actions, gated by can()
│   │   ├── StatusBadge.tsx
│   │   └── primitives.tsx       # Button, Input, Select, Card
│   ├── integrations/
│   │   ├── index.ts             # getIntegration(name)
│   │   ├── types.ts             # Integration interface, IntegrationError
│   │   ├── config.ts            # the one place env is read
│   │   ├── slack/{client.ts,mock.ts}
│   │   ├── email/{client.ts,mock.ts}
│   │   └── payments/{client.ts,mock.ts}
│   └── spec.ts                  # AppSpec type
├── src/app/                     # Next.js routes, generic, never app-specific
│   ├── layout.tsx
│   ├── page.tsx                 # portal home: app grid
│   ├── login/page.tsx
│   ├── tools/[app]/page.tsx     # list
│   ├── tools/[app]/[id]/page.tsx# detail + actions
│   ├── audit/page.tsx
│   └── api/auth/[...nextauth]/route.ts
└── devin/
    ├── 01-scaffold-brief.md     # this document, section 4
    ├── 02-kyc-brief.md          # section 5
    ├── 03-fraud-brief.md        # section 6
    └── sessions.md              # per session: link, start/end time, review comments, cuts
```

---

## 3. Conventions (apply in every session)

These are the rules a reviewer will check on every PR. Violating them is a blocking review comment.

1. An app imports only from `@platform/*`. Never from another app. Never from `src/app`.
2. Every function in an app's `actions.ts` calls `assertCan(user, appKey, actionKey)` as its first statement.
3. Every database write goes through `db` from `@platform/db/client`. `rawDb` is used only in `platform/db/seed.ts`.
4. No `fetch` to an external host anywhere except inside `platform/integrations/*/client.ts`.
5. No `process.env` reads outside `platform/integrations/config.ts` and `platform/auth/config.ts`.
6. Prisma models for an app are prefixed with the app's short name (`KycCase`, `FraudHeldTransaction`).
7. Registering an app touches exactly one line in `apps/registry.ts`. Nothing in `platform/` or `src/app/` changes when an app is added.
8. Each app has a test file covering every action against every role.
9. Commit messages reference the session (`[S1]`, `[S2]`, `[S3]`).

---

## 4. Session 1 — Scaffold platform and portal (~60 min)

### 4.1 Roles

```ts
export const ROLES = [
  "viewer",
  "kyc_analyst",
  "kyc_lead",
  "fraud_analyst",
  "fraud_lead",
  "admin",
] as const;
export type Role = typeof ROLES[number];
```

A user has exactly one role. `admin` passes every `can()` check.

### 4.2 Permissions

```ts
// platform/permissions/can.ts
export function can(user: User, resource: string, action: string): boolean;
export function assertCan(user: User, resource: string, action: string): void; // throws ForbiddenError
```

Backed by a static map in `roles.ts`:

```ts
export const PERMISSIONS: Record<Role, Record<string, string[]>> = {
  viewer:        { "kyc-review": ["read"], "fraud-review": ["read"] },
  kyc_analyst:   { "kyc-review": ["read", "claim", "approve", "reject", "requestInfo"] },
  kyc_lead:      { "kyc-review": ["read", "claim", "approve", "reject", "requestInfo", "override"] },
  fraud_analyst: { "fraud-review": ["read", "claim", "release", "confirmFraud", "escalate"] },
  fraud_lead:    { "fraud-review": ["read", "claim", "release", "confirmFraud", "escalate", "approveHighValue"] },
  admin:         { "*": ["*"] },
};
```

Special action `"read"` also controls whether the app tile appears on the portal home. Hiding the tile is a convenience; enforcement is `assertCan` in actions and `requireUser` in route loaders.

### 4.3 Auth

- Auth.js Credentials provider: login page lists seeded users as buttons (name + role). Clicking one signs in. No password. This is demo-only and the login page says so in small text.
- Entra ID provider: configured in `auth/config.ts`, added to the providers array only if `AUTH_MICROSOFT_ENTRA_ID_ID` and `AUTH_MICROSOFT_ENTRA_ID_SECRET` are set. On Entra sign-in, look up the user by email in the `User` table; if absent, create with role `viewer`.
- Session carries `{ id, name, email, role }`.
- `platform/auth/context.ts` exposes `runWithActor(user, fn)` using `AsyncLocalStorage`, and `getActor()`. Server actions and route handlers wrap their work in `runWithActor`.

### 4.4 Audit

Prisma schema:

```prisma
model AuditLog {
  id         String   @id @default(cuid())
  at         DateTime @default(now())
  actorId    String?
  actorName  String?
  actorRole  String?
  app        String?          // from spec key when available
  model      String
  recordId   String?
  action     String           // create | update | delete | integration
  before     Json?
  after      Json?
  meta       Json?            // for integration calls: { integration, method, args }
}
```

`platform/audit/extension.ts` wraps `create`, `update`, `delete`, `updateMany`, `deleteMany` for all models except `AuditLog`. For `update`/`delete` it reads the row before mutating. Actor comes from `getActor()`; if none, `actorName = "system"`.

`platform/audit/write.ts` exports `writeAudit(entry)` for direct use by integrations.

### 4.5 Integrations

```ts
// platform/integrations/types.ts
export interface Integration { readonly name: string; }
export class IntegrationError extends Error { constructor(public integration: string, public cause?: unknown) }

// platform/integrations/index.ts
export function getIntegration<T extends Integration>(name: "slack" | "email" | "payments"): T;
```

Each integration folder has `client.ts` (real implementation, may be a thin stub that throws "not configured" for payments) and `mock.ts`. `config.ts` selects mock when `INTEGRATIONS_MODE=mock` (default) and logs each call to console. Every call, mock or real, writes an audit row with `action: "integration"` and `meta: { integration, method, args }`. Never log secrets in `meta`.

Interfaces:

```ts
interface SlackIntegration extends Integration { postMessage(channel: string, text: string): Promise<void>; }
interface EmailIntegration extends Integration { send(to: string, subject: string, body: string): Promise<void>; }
interface PaymentsIntegration extends Integration {
  release(transactionId: string): Promise<void>;
  block(transactionId: string): Promise<void>;
  flagCustomer(customerId: string, reason: string): Promise<void>;
}
```

`payments/client.ts` throws `IntegrationError("payments", "not configured")`. The README explains why: a real processor integration pulls this tool into PCI scope and needs its own review.

### 4.6 AppSpec

```ts
// platform/spec.ts
export type FieldType = "text" | "textarea" | "number" | "money" | "select" | "bool" | "datetime" | "json";

export type AppSpec<Row = any> = {
  key: string;                       // "kyc-review", used in URLs and permissions
  title: string;
  description: string;               // shown on portal tile
  model: string;                     // Prisma model name, camelCase, e.g. "kycCase"
  idField?: string;                  // default "id"
  columns: Array<{ field: keyof Row & string; label: string; render?: "status" | "money" | "datetime" }>;
  fields: Array<{
    field: keyof Row & string;
    label: string;
    type: FieldType;
    options?: string[];
    editableBy: Role[];              // empty = read-only
  }>;
  statusField?: keyof Row & string;
  transitions?: Record<string, string[]>;
  actions: Array<{
    key: string;                     // must match a permissions action
    label: string;
    variant?: "primary" | "danger" | "default";
    visibleWhen?: (row: Row, user: User) => boolean;
    requiresNote?: boolean;
    run: (id: string, user: User, input?: { note?: string }) => Promise<void>;
  }>;
  defaultSort?: { field: keyof Row & string; dir: "asc" | "desc" };
  filters?: Array<{ field: keyof Row & string; label: string; options: string[] }>;
};
```

`apps/registry.ts`:

```ts
import { kycReview } from "./kyc-review/spec";
import { fraudReview } from "./fraud-review/spec";
export const APPS: AppSpec[] = [kycReview, fraudReview];
export function getApp(key: string): AppSpec | undefined;
```

In Session 1, `registry.ts` exists with an empty array and the generic routes render an empty portal. Session 2 adds the first entry.

### 4.7 Generic routes

- `/login`: user buttons.
- `/`: grid of tiles for every app where `can(user, app.key, "read")`.
- `/tools/[app]`: `ResourceTable` with filters, default sort, status badges, row links. `requireUser` + `assertCan(user, app.key, "read")`.
- `/tools/[app]/[id]`: `ResourceForm` (fields editable per `editableBy`) plus `ActionBar`. Save is a server action that calls `assertCan(user, app.key, "update")` — note `update` must be granted explicitly in permissions for roles that may edit fields; for the PoC, grant `update` to analysts and leads of each app.
- `/audit`: table of `AuditLog`, newest first, filters on app, model, action, actor. Expandable before/after diff. Visible to `admin`, `kyc_lead`, `fraud_lead`; add `audit: ["read"]` to those roles.

All pages are server components. Actions are Next.js server actions wrapped in `runWithActor`.

### 4.8 Seed (Session 1 portion)

`platform/db/seed.ts` creates users:

| name | email | role |
|---|---|---|
| Vera Viewer | vera@example.com | viewer |
| Kai Analyst | kai@example.com | kyc_analyst |
| Lena Lead | lena@example.com | kyc_lead |
| Farid Analyst | farid@example.com | fraud_analyst |
| Freya Lead | freya@example.com | fraud_lead |
| Ada Admin | ada@example.com | admin |

Seed uses `rawDb` so it does not pollute the audit log.

### 4.9 Definition of done — Session 1

- `docker compose up -d && npm i && npm run db:migrate && npm run db:seed && npm run dev` works from a clean clone.
- Login as each user; portal renders (empty grid is fine); `/audit` is reachable by admin and leads, forbidden to others.
- `permissions.test.ts` passes.
- A test proves an `update` on any model through `db` writes an `AuditLog` row with actor and before/after.
- `getIntegration("slack").postMessage()` in mock mode writes an audit row.
- README has: purpose, run steps, folder guide, conventions section (copy section 3), "what is stubbed and why".
- `devin/sessions.md` has session 1 entry.

---

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

---

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

---

## 7. README requirements (root)

1. One paragraph: what this is and what it is not.
2. Run steps (five commands) and the demo script from 6.6.
3. Folder guide: platform / apps / src/app / devin, two lines each.
4. Conventions (section 3 verbatim).
5. What Power Apps capability each platform module stands in for (short table).
6. Stubbed and deferred: Entra (config present, off by default), payments (mock only, PCI note), refunds app, feature-flags app, per-app deploys, mobile, workflows.
7. Link to `devin/sessions.md`.

---

## 8. What to do if something is ambiguous

Pick the simplest option that satisfies section 3, implement it, and note the choice in `devin/sessions.md` under "decisions". Do not stop to ask unless the ambiguity blocks a definition-of-done item.