import {
    createUserBodySchema,
    userParamsSchema,
    userResponseSchema,
    toUserResponse,
} from "./user.schema.js";
import { errorResponseSchema } from "@/lib/schemas.js";
import type { UserService } from "./user.service.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

const USER_TAG = "users";

export const userRoutes =
    (service: UserService): FastifyPluginAsyncZod =>
    async (fastify) => {
        fastify.post(
            "/",
            {
                schema: {
                    tags: [USER_TAG],
                    summary: "Create a user",
                    body: createUserBodySchema,
                    response: {
                        201: userResponseSchema,
                        409: errorResponseSchema,
                    },
                },
            },
            async (request, reply) => {
                const user = await service.createUser(request.body);

                return reply.code(201).send(toUserResponse(user));
            },
        );

        fastify.get(
            "/:id",
            {
                schema: {
                    tags: [USER_TAG],
                    summary: "Get a user by id",
                    params: userParamsSchema,
                    response: {
                        200: userResponseSchema,
                        404: errorResponseSchema,
                    },
                },
            },
            async (request) => {
                const user = await service.getUser(request.params.id);

                return toUserResponse(user);
            },
        );
    };
