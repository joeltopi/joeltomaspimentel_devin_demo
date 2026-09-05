# Session 1 brief — platform scaffold

Context: sections 0–3 of `00-full-brief.md` apply to every session.

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

