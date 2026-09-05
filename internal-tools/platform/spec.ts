import type { Actor } from "@platform/permissions/can";
import type { Role } from "@platform/permissions/roles";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "money"
  | "select"
  | "bool"
  | "datetime"
  | "json";

export type Renderer = "status" | "money" | "datetime" | "chips";

export type Row = Record<string, unknown>;

export type Column<R extends Row = Row> = {
  field: keyof R & string;
  label: string;
  render?: Renderer;
};

export type Field<R extends Row = Row> = {
  field: keyof R & string;
  label: string;
  type: FieldType;
  options?: string[];
  /** Empty array means read-only for everyone. */
  editableBy: Role[];
};

export type FilterSpec<R extends Row = Row> = {
  field: keyof R & string;
  label: string;
  options: string[];
};

export type AppAction<R extends Row = Row> = {
  /** Must match an action in the permissions map for this app key. */
  key: string;
  label: string;
  variant?: "primary" | "danger" | "default";
  visibleWhen?: (row: R, user: Actor) => boolean;
  requiresNote?: boolean;
  run: (id: string, user: Actor, input?: { note?: string }) => Promise<void>;
};

export type AppSpec<R extends Row = Row> = {
  key: string;
  title: string;
  description: string;
  /** Prisma model name in camelCase, e.g. "kycCase". */
  model: string;
  idField?: string;
  columns: Array<Column<R>>;
  fields: Array<Field<R>>;
  statusField?: keyof R & string;
  transitions?: Record<string, string[]>;
  actions: Array<AppAction<R>>;
  defaultSort?: { field: keyof R & string; dir: "asc" | "desc" };
  filters?: Array<FilterSpec<R>>;
};

/** Thrown by app actions when a business guard fails; message is shown to the user. */
export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}
