import { describe, expect, it } from "vitest";
import { createTaskService } from "@/modules/task/task.service.js";
import {
    DueDateInPastError,
    TaskAlreadyDoneError,
    TaskNotFoundError,
} from "@/modules/task/task.errors.js";
import { fixedClock } from "../helpers/fixed-clock.js";
import { createInMemoryTaskRepository } from "../helpers/in-memory-task-repository.js";

/**
 * Use-case tests: real service, real entity rules, in-memory port
 * implementations. No Fastify, no database, no mocking framework.
 */
const NOW = "2026-08-20T12:00:00Z";

const makeService = () => {
    const clock = fixedClock(NOW);
    const repository = createInMemoryTaskRepository(clock);
    const service = createTaskService({ repository, clock });

    return { service, repository };
};

describe("createTask", () => {
    it("persists and returns the created task", async () => {
        const { service, repository } = makeService();

        const task = await service.createTask({ title: "ship the template" });

        expect(task).toMatchObject({
            title: "ship the template",
            status: "open",
            dueDate: null,
        });
        expect(repository.rows()).toHaveLength(1);
    });

    it("rejects a due date before now", async () => {
        const { service, repository } = makeService();

        await expect(
            service.createTask({
                title: "too late",
                dueDate: new Date("2026-08-20T11:59:59Z"),
            }),
        ).rejects.toBeInstanceOf(DueDateInPastError);

        expect(repository.rows()).toHaveLength(0);
    });
});

describe("getTask", () => {
    it("returns the task by id", async () => {
        const { service } = makeService();
        const created = await service.createTask({ title: "find me" });

        await expect(service.getTask(created.id)).resolves.toEqual(created);
    });

    it("throws TaskNotFoundError for an unknown id", async () => {
        const { service } = makeService();

        await expect(service.getTask(999)).rejects.toBeInstanceOf(TaskNotFoundError);
    });
});

describe("completeTask", () => {
    it("persists the transition to done", async () => {
        const { service, repository } = makeService();
        const created = await service.createTask({ title: "finish me" });

        const done = await service.completeTask(created.id);

        expect(done.status).toBe("done");
        expect(repository.rows()[0]?.status).toBe("done");
    });

    it("surfaces the domain rule when completing twice", async () => {
        const { service } = makeService();
        const created = await service.createTask({ title: "once only" });

        await service.completeTask(created.id);

        await expect(service.completeTask(created.id)).rejects.toBeInstanceOf(
            TaskAlreadyDoneError,
        );
    });
});

describe("listTasks", () => {
    it("returns newest first with a working cursor", async () => {
        const { service } = makeService();

        const first = await service.createTask({ title: "first" });
        const second = await service.createTask({ title: "second" });
        const third = await service.createTask({ title: "third" });

        const pageOne = await service.listTasks({ limit: 2 });

        expect(pageOne.items.map((task) => task.id)).toEqual([third.id, second.id]);
        expect(pageOne.nextCursor).toBe(second.id);

        const pageTwo = await service.listTasks({
            limit: 2,
            cursor: pageOne.nextCursor ?? undefined,
        });

        expect(pageTwo.items.map((task) => task.id)).toEqual([first.id]);
        expect(pageTwo.nextCursor).toBeNull();
    });

    it("filters by status", async () => {
        const { service } = makeService();

        await service.createTask({ title: "stays open" });
        const toComplete = await service.createTask({ title: "gets done" });

        await service.completeTask(toComplete.id);

        const done = await service.listTasks({ limit: 10, status: "done" });

        expect(done.items.map((task) => task.title)).toEqual(["gets done"]);
    });
});
