import { archiveTask, completeTask, draftTask } from "./task.entity.js";
import { TaskNotFoundError } from "./task.errors.js";
import type { Task } from "./task.entity.js";
import type { TaskListQuery, TaskRepository } from "./task.repository.js";
import type { Clock } from "@/lib/clock.js";
import type { Page } from "@/lib/pagination.js";

/**
 * The application layer: one function per use case. Note what is absent —
 * no Fastify, no Zod, no Prisma, no HTTP status codes, no response envelopes.
 * Inputs and outputs are the module's own types, so this file is fully
 * exercised by unit tests with an in-memory repository and a fixed clock.
 */
export type CreateTaskInput = {
    title: string;
    dueDate?: Date | null;
};

export type TaskService = {
    createTask: (input: CreateTaskInput) => Promise<Task>;
    getTask: (id: number) => Promise<Task>;
    listTasks: (query: TaskListQuery) => Promise<Page<Task>>;
    completeTask: (id: number) => Promise<Task>;
    archiveTask: (id: number) => Promise<Task>;
};

export type TaskServiceDeps = {
    repository: TaskRepository;
    clock: Clock;
};

export const createTaskService = ({
    repository,
    clock,
}: TaskServiceDeps): TaskService => {
    const getTask = async (id: number): Promise<Task> => {
        const task = await repository.findById(id);

        if (task === null) {
            throw new TaskNotFoundError();
        }

        return task;
    };

    return {
        // async so a rule rejection surfaces as a rejected promise, never a
        // synchronous throw from a Promise-returning API.
        createTask: async (input) =>
            repository.create(draftTask(input, clock.now())),

        getTask,

        listTasks: (query) => repository.list(query),

        completeTask: async (id) => repository.save(completeTask(await getTask(id))),

        archiveTask: async (id) => repository.save(archiveTask(await getTask(id))),
    };
};
