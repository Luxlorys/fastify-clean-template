import type { TaskCache } from "./cache.port.js";
import type { TaskRepository } from "./repository.port.js";
import type { CreateTaskInput, ListTasksInput, TaskDto } from "../dto/task.dto.js";
import type { Clock } from "@/lib/clock.js";
import type { Page } from "@/lib/pagination.js";

export type TaskService = {
    createTask: (input: CreateTaskInput) => Promise<TaskDto>;
    getTask: (id: number) => Promise<TaskDto>;
    listTasks: (input: ListTasksInput) => Promise<Page<TaskDto>>;
    completeTask: (id: number) => Promise<TaskDto>;
    archiveTask: (id: number) => Promise<TaskDto>;
};

export type TaskServiceDeps = {
    repository: TaskRepository;
    cache: TaskCache;
    clock: Clock;
};
