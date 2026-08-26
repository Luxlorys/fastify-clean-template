import type { NewTask, Task, TaskStatus } from "./task.entity.js";
import type { Clock } from "@/lib/clock.js";
import type { Page, PageQuery } from "@/lib/pagination.js";

export type TaskListQuery = PageQuery & {
    status?: TaskStatus;
};

export type TaskRepository = {
    create: (data: NewTask) => Promise<Task>;
    findById: (id: number) => Promise<Task | null>;
    save: (task: Task) => Promise<Task>;
    list: (query: TaskListQuery) => Promise<Page<Task>>;
};

export type TaskCache = {
    read: (id: number) => Promise<Task | null>;
    write: (task: Task) => Promise<void>;
    forget: (id: number) => Promise<void>;
};

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
    cache: TaskCache;
    clock: Clock;
};

export type TaskPublicApi = {
    createTask: (input: { title: string }) => Promise<{ id: number }>;
};
