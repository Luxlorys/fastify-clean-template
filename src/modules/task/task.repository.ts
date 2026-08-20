import type { NewTask, Task, TaskStatus } from "./task.entity.js";
import type { Page, PageQuery } from "@/lib/pagination.js";

/**
 * The persistence PORT: the narrow interface the service needs from storage,
 * written in the module's own vocabulary. It speaks Task and NewTask — never
 * Prisma types, never a query DSL. The Prisma implementation lives in
 * task.repository.prisma.ts; tests use the in-memory implementation in
 * test/helpers/. Neither side knows about the other.
 */
export type TaskListQuery = PageQuery & {
    status?: TaskStatus;
};

export type TaskRepository = {
    create: (data: NewTask) => Promise<Task>;
    findById: (id: number) => Promise<Task | null>;
    /** Persist the current state of an already-existing task. */
    save: (task: Task) => Promise<Task>;
    /** Newest first, cursor-paginated. */
    list: (query: TaskListQuery) => Promise<Page<Task>>;
};
