import { TASK_STATUSES } from "./task.entity.js";
import type { Task } from "./task.entity.js";
import type { TaskCache } from "./task.ports.js";
import type { Redis } from "ioredis";

/**
 * The Redis implementation of the TaskCache port — the only file in this
 * module that knows Redis exists. Key layout, TTL, the JSON codec and the
 * failure policy all live here; the port above says none of it.
 *
 * The `v1` in the key is load-bearing: a cached blob outlives a deploy, so
 * changing the shape of `Task` while old JSON sits in Redis would hand the
 * revive step a document it cannot honor. Bump the version on any shape
 * change and the old keys simply expire unread.
 */
const KEY_VERSION = "v1";

const keyFor = (id: number) => `task:${KEY_VERSION}:${id}`;

/**
 * JSON has no Date, so `createdAt` and `dueDate` come back as strings. Revive
 * them here — this is the cache twin of the Prisma adapter's `toTask()`, and
 * the same rule applies: a row shape never leaves the adapter.
 *
 * Anything unexpected returns null rather than throwing. A blob written by an
 * older deploy is a cache miss, not a 500.
 */
const parseTask = (raw: string): Task | null => {
    const value: unknown = JSON.parse(raw);

    if (typeof value !== "object" || value === null) {
        return null;
    }

    const { id, title, status, dueDate, createdAt } = value as Record<
        string,
        unknown
    >;

    if (
        typeof id !== "number" ||
        typeof title !== "string" ||
        typeof status !== "string" ||
        !TASK_STATUSES.includes(status as Task["status"]) ||
        typeof createdAt !== "string" ||
        (dueDate !== null && typeof dueDate !== "string")
    ) {
        return null;
    }

    return {
        id,
        title,
        status: status as Task["status"],
        dueDate: dueDate === null ? null : new Date(dueDate),
        createdAt: new Date(createdAt),
    };
};

export const createRedisTaskCache = (
    redis: Redis,
    ttlSeconds: number,
): TaskCache => ({
    read: async (id) => {
        try {
            const raw = await redis.get(keyFor(id));

            return raw === null ? null : parseTask(raw);
        } catch {
            // A cache outage degrades to a database read. Failing the request
            // because the cache is unavailable would make the cache a new
            // single point of failure, which is the opposite of the point.
            return null;
        }
    },

    write: async (task) => {
        try {
            await redis.set(keyFor(task.id), JSON.stringify(task), "EX", ttlSeconds);
        } catch {
            // Best effort, as the port says.
        }
    },

    forget: async (id) => {
        try {
            await redis.del(keyFor(id));
        } catch {
            // A failed invalidation serves stale reads until the entry expires,
            // so the TTL is the bound on how wrong this can get. Throwing here
            // would fail a request whose database write already committed —
            // strictly worse. If a use case needs invalidation to be
            // guaranteed, it needs an outbox, not a longer catch block.
        }
    },
});
