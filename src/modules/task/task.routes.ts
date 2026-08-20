import {
    createTaskBodySchema,
    listTasksQuerySchema,
    taskPageResponseSchema,
    taskParamsSchema,
    taskResponseSchema,
    toTaskResponse,
} from "./task.schema.js";
import { errorResponseSchema } from "@/lib/schemas.js";
import type { TaskService } from "./task.service.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

const TASK_TAG = "tasks";

/**
 * The HTTP edge of the module. Handlers stay thin: parse (done by Fastify via
 * the schema), call the service, map the result to the wire shape. Domain
 * errors thrown below are translated to status codes by the error-handler
 * plugin — no try/catch here.
 */
export const taskRoutes =
    (service: TaskService): FastifyPluginAsyncZod =>
    async (fastify) => {
        fastify.post(
            "/",
            {
                schema: {
                    tags: [TASK_TAG],
                    summary: "Create a task",
                    body: createTaskBodySchema,
                    response: {
                        201: taskResponseSchema,
                        422: errorResponseSchema,
                    },
                },
            },
            async (request, reply) => {
                const task = await service.createTask(request.body);

                return reply.code(201).send(toTaskResponse(task));
            },
        );

        fastify.get(
            "/",
            {
                schema: {
                    tags: [TASK_TAG],
                    summary: "List tasks (newest first, cursor-paginated)",
                    querystring: listTasksQuerySchema,
                    response: {
                        200: taskPageResponseSchema,
                    },
                },
            },
            async (request) => {
                const page = await service.listTasks(request.query);

                return {
                    items: page.items.map(toTaskResponse),
                    nextCursor: page.nextCursor,
                };
            },
        );

        fastify.get(
            "/:id",
            {
                schema: {
                    tags: [TASK_TAG],
                    summary: "Get a task by id",
                    params: taskParamsSchema,
                    response: {
                        200: taskResponseSchema,
                        404: errorResponseSchema,
                    },
                },
            },
            async (request) => {
                const task = await service.getTask(request.params.id);

                return toTaskResponse(task);
            },
        );

        fastify.post(
            "/:id/complete",
            {
                schema: {
                    tags: [TASK_TAG],
                    summary: "Mark a task as done",
                    params: taskParamsSchema,
                    response: {
                        200: taskResponseSchema,
                        404: errorResponseSchema,
                        409: errorResponseSchema,
                    },
                },
            },
            async (request) => {
                const task = await service.completeTask(request.params.id);

                return toTaskResponse(task);
            },
        );

        fastify.post(
            "/:id/archive",
            {
                schema: {
                    tags: [TASK_TAG],
                    summary: "Archive a task (idempotent)",
                    params: taskParamsSchema,
                    response: {
                        200: taskResponseSchema,
                        404: errorResponseSchema,
                    },
                },
            },
            async (request) => {
                const task = await service.archiveTask(request.params.id);

                return toTaskResponse(task);
            },
        );
    };
