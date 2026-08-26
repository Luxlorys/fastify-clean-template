import type { Task } from "./task.entity.js";
import type { TaskCache } from "./task.ports.js";
import type { TaskRepository } from "./task.repository.js";

/**
 * Read-through caching as a DECORATOR over the repository port, not as a
 * branch inside the service. The service keeps calling `repository.findById`
 * and never learns a cache exists — which is why no use case grows an
 * `if (cached)` and why turning caching off is one line in index.ts.
 *
 * Note what this file imports: two ports and the domain. No Redis, no Prisma,
 * no framework. It is exercised by the unit lane with two in-memory
 * implementations, so the caching logic itself needs no container.
 *
 * Invalidation sits on the write path (`save`), where it cannot be forgotten
 * — the failure mode of hand-rolled caching is always a write that busts
 * nothing.
 */
export const createCachedTaskRepository = (
    inner: TaskRepository,
    cache: TaskCache,
): TaskRepository => ({
    findById: async (id): Promise<Task | null> => {
        const cached = await cache.read(id);

        if (cached !== null) {
            return cached;
        }

        const task = await inner.findById(id);

        if (task !== null) {
            await cache.write(task);
        }

        return task;
    },

    save: async (task) => {
        const saved = await inner.save(task);

        await cache.forget(saved.id);

        return saved;
    },

    create: (data) => inner.create(data),

    /**
     * Deliberately uncached. Results are cursor-paginated and filtered, so a
     * single write invalidates an unbounded set of pages — the invalidation is
     * combinatorial and the hit rate is poor. Cache entities by id; let lists
     * hit the database.
     */
    list: (query) => inner.list(query),
});
