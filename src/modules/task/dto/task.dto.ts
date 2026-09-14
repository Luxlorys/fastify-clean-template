import type { Task, TaskStatus } from "../task.entity.js";
import type { Page } from "@/lib/pagination.js";

export type CreateTaskInput = {
    title: string;
    dueDate?: Date | null;
};

export type ListTasksInput = {
    limit: number;
    cursor?: number;
    status?: TaskStatus;
};

export type TaskDto = {
    id: number;
    title: string;
    status: TaskStatus;
    dueDate: Date | null;
    createdAt: Date;
};

export const toCreateTaskInput = (body: {
    title: string;
    dueDate?: Date;
}): CreateTaskInput => ({
    title: body.title,
    dueDate: body.dueDate ?? null,
});

export const toListTasksInput = (query: {
    limit: number;
    cursor?: number;
    status?: TaskStatus;
}): ListTasksInput => ({
    limit: query.limit,
    cursor: query.cursor,
    status: query.status,
});

export const toTaskDto = (task: Task): TaskDto => ({
    id: task.id,
    title: task.title,
    status: task.status,
    dueDate: task.dueDate,
    createdAt: task.createdAt,
});

export const toTaskPageDto = (page: Page<Task>): Page<TaskDto> => ({
    items: page.items.map(toTaskDto),
    nextCursor: page.nextCursor,
});

export const toTaskResponse = (dto: TaskDto) => ({
    id: dto.id,
    title: dto.title,
    status: dto.status,
    dueDate: dto.dueDate === null ? null : dto.dueDate.toISOString(),
    createdAt: dto.createdAt.toISOString(),
});

export const toTaskPageResponse = (page: Page<TaskDto>) => ({
    items: page.items.map(toTaskResponse),
    nextCursor: page.nextCursor,
});
