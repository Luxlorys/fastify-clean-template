import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

const healthResponseSchema = z.object({
    status: z.enum(["ok", "degraded"]),
    database: z.enum(["up", "down"]),
});

/**
 * Health reports on the process, not on a business capability, so it is the
 * one route allowed to skip the service layer and touch infrastructure
 * directly. A module can be this small: when there is no domain, the module
 * is just its routes.
 */
export const healthModule: FastifyPluginAsyncZod = async (fastify) => {
    fastify.get(
        "/",
        {
            schema: {
                tags: ["health"],
                summary: "Liveness and database connectivity",
                response: {
                    200: healthResponseSchema,
                    503: healthResponseSchema,
                },
            },
        },
        async (_request, reply) => {
            try {
                await fastify.prisma.$queryRaw`SELECT 1`;
            } catch (error) {
                fastify.log.error(
                    { err: error },
                    "health check: database unreachable",
                );

                return reply
                    .code(503)
                    .send({ status: "degraded", database: "down" } as const);
            }

            return { status: "ok", database: "up" } as const;
        },
    );
};
