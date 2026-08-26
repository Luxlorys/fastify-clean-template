import { describe, expect, it } from "vitest";
import { createCachedTaskRepository } from "@/modules/task/task.repository.cached.js";
import { completeTask } from "@/modules/task/task.entity.js";
import {
    createBrokenTaskCache,
    createInMemoryTaskCache,
} from "../helpers/in-memory-task-cache.js";
import { createInMemoryTaskRepository } from "../helpers/in-memory-task-repository.js";
import { fixedClock } from "../helpers/fixed-clock.js";
import type { TaskRepository } from "@/modules/task/task.repository.js";

/**
 * Caching is a decorator over the port, so it tests like any other pure
 * function: two in-memory implementations, no Redis, no container, no mocks.
 * The Redis adapter's own behavior is covered separately in the integration
 * lane (test/int/task.cache.redis.test.ts).
 */
const NOW = "2026-01-01T00:00:00.000Z";

/** Counts calls to the inner port so a cache HIT is observable, not inferred. */
const countingRepository = (inner: TaskRepository) => {
    let findByIdCalls = 0;

    return {
        repository: {
            ...inner,
            findById: async (id: number) => {
                findByIdCalls++;

                return inner.findById(id);
            },
        } satisfies TaskRepository,
        findByIdCalls: () => findByIdCalls,
    };
};

const setup = () => {
    const inner = countingRepository(createInMemoryTaskRepository(fixedClock(NOW)));
    const cache = createInMemoryTaskCache();

    return {
        ...inner,
        cache,
        repository: createCachedTaskRepository(inner.repository, cache),
        inner: inner.repository,
    };
};

describe("createCachedTaskRepository", () => {
    it("fills the cache on a miss and serves the second read without touching the source", async () => {
        const { repository, inner, findByIdCalls, cache } = setup();

        const created = await inner.create({
            title: "Write the ADR",
            status: "open",
            dueDate: null,
        });

        const first = await repository.findById(created.id);
        const second = await repository.findById(created.id);

        expect(first).toEqual(created);
        expect(second).toEqual(created);
        expect(cache.keys()).toEqual([created.id]);
        // One database read for two calls — that is the cache working.
        expect(findByIdCalls()).toBe(1);
    });

    it("does not cache a miss, so a later create is visible immediately", async () => {
        const { repository, inner, cache } = setup();

        expect(await repository.findById(1)).toBeNull();
        expect(cache.keys()).toEqual([]);

        const created = await inner.create({
            title: "Appears later",
            status: "open",
            dueDate: null,
        });

        expect(await repository.findById(created.id)).toEqual(created);
    });

    it("invalidates on save, so the next read sees the new state", async () => {
        const { repository, cache } = setup();

        const created = await repository.create({
            title: "Ship it",
            status: "open",
            dueDate: null,
        });

        await repository.findById(created.id);
        expect(cache.keys()).toEqual([created.id]);

        await repository.save(completeTask(created));
        expect(cache.keys()).toEqual([]);

        const reread = await repository.findById(created.id);
        expect(reread?.status).toBe("done");
    });

    it("leaves list uncached — every call reaches the source", async () => {
        const { repository, cache } = setup();

        await repository.create({ title: "A", status: "open", dueDate: null });

        const first = await repository.list({ limit: 10 });
        await repository.create({ title: "B", status: "open", dueDate: null });
        const second = await repository.list({ limit: 10 });

        expect(first.items).toHaveLength(1);
        expect(second.items).toHaveLength(2);
        expect(cache.keys()).toEqual([]);
    });

    it("does not swallow cache errors — resilience belongs to the adapter", async () => {
        const inner = createInMemoryTaskRepository(fixedClock(NOW));
        const repository = createCachedTaskRepository(
            inner,
            createBrokenTaskCache(),
        );

        const created = await inner.create({
            title: "Redis is on fire",
            status: "open",
            dueDate: null,
        });

        // Deliberate: the decorator is pure and propagates. What keeps a Redis
        // outage from failing requests is the ADAPTER, which catches and
        // returns null — proven against a dead server in
        // test/int/task.cache.redis.test.ts. Putting the catch here instead
        // would hide a genuinely broken port implementation behind a silent
        // fallback, and no test would ever notice.
        await expect(repository.findById(created.id)).rejects.toThrow(
            "cache unavailable",
        );
    });
});
