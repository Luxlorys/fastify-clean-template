import type { Task } from "../task.entity.js";

export type TaskCache = {
    read: (id: number) => Promise<Task | null>;
    write: (task: Task) => Promise<void>;
    forget: (id: number) => Promise<void>;
};
