import type { NewTask, Task, TaskStatus } from "../task.entity.js";
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
