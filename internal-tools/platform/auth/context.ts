import { AsyncLocalStorage } from "node:async_hooks";
import type { Actor } from "@platform/permissions/can";

const storage = new AsyncLocalStorage<Actor>();

/** Runs `fn` with `user` as the ambient actor for auditing. */
export function runWithActor<T>(user: Actor, fn: () => T): T {
  return storage.run(user, fn);
}

export function getActor(): Actor | undefined {
  return storage.getStore();
}
