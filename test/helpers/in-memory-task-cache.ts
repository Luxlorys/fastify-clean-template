import type { Task } from "@/modules/task/task.entity.js";
import type { TaskCache } from "@/modules/task/task.ports.js";

/**
 * A genuine implementation of the TaskCache port, not a mock. It honors the
 * same contract the Redis adapter honors — a miss is null, a write replaces,
 * a forget removes — so the decorator's unit tests run the production code
 * path with the container swapped out.
 *
 * `reads` is exposed so a test can assert the database was NOT consulted,
 * which is the whole point of a cache and cannot be observed from the result.
 */
export const createInMemoryTaskCache = (): TaskCache & {
    reads: () => number;
    keys: () => number[];
} => {
    const entries = new Map<number, Task>();
    let reads = 0;

    return {
        reads: () => reads,
        keys: () => [...entries.keys()],

        read: async (id) => {
            reads++;

            return entries.get(id) ?? null;
        },

        write: async (task) => {
            entries.set(task.id, task);
        },

        forget: async (id) => {
            entries.delete(id);
        },
    };
};

/**
 * A cache that is always down: every operation rejects. The port's contract
 * says a broken cache degrades to the source of truth rather than failing the
 * request, and that promise is only worth having if a test holds it.
 */
export const createBrokenTaskCache = (): TaskCache => ({
    read: async () => {
        throw new Error("cache unavailable");
    },
    write: async () => {
        throw new Error("cache unavailable");
    },
    forget: async () => {
        throw new Error("cache unavailable");
    },
});
