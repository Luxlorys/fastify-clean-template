import type { Task } from "./task.entity.js";

/**
 * Outbound ports: capabilities this module needs from the outside world,
 * declared in the module's own vocabulary. Note what the type does NOT say —
 * no key names, no TTL, no `get`/`set`/`expire`. Those are Redis words, and
 * they live in the adapter (task.cache.redis.ts). The rest of the module only
 * ever sees this type, so the unit lane substitutes an in-memory
 * implementation and never starts a container.
 */
export type TaskCache = {
    /** The cached task, or null on a miss — including when the cache is down. */
    read: (id: number) => Promise<Task | null>;
    /** Best effort: a cache that refuses a write must not fail the request. */
    write: (task: Task) => Promise<void>;
    /** Drops the entry so the next read goes to the source of truth. */
    forget: (id: number) => Promise<void>;
};
