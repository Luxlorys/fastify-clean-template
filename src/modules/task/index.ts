import fp from "fastify-plugin";
import { createRedisTaskCache } from "./task.cache.redis.js";
import { createCachedTaskRepository } from "./task.repository.cached.js";
import { createPrismaTaskRepository } from "./task.repository.prisma.js";
import { createTaskService } from "./task.service.js";
import { taskRoutes } from "./task.routes.js";
import { systemClock } from "@/lib/clock.js";
import type { FastifyInstance } from "fastify";

/**
 * The module's composition root: the only file that knows which adapter
 * implements which port. Wiring is explicit and compiler-checked — swap the
 * Prisma repository for another implementation by changing one line here,
 * and nothing else in the module moves.
 *
 * This is a PUBLISHER module: it decorates the instance with `taskService`
 * so sibling modules (see modules/onboarding) can consume the capability
 * without importing this folder. fastify-plugin lets the decoration escape
 * encapsulation; the routes are re-encapsulated with their prefix below.
 */
const taskModule = async (fastify: FastifyInstance) => {
    // Caching is a decorator over the port, so it is added — or removed —
    // here and nowhere else. The service below is identical either way.
    const repository = createCachedTaskRepository(
        createPrismaTaskRepository(fastify.prisma),
        createRedisTaskCache(fastify.redis, fastify.config.CACHE_TTL_SECONDS),
    );

    const service = createTaskService({ repository, clock: systemClock });

    fastify.decorate("taskService", service);

    await fastify.register(taskRoutes(service), { prefix: "/api/tasks" });
};

export default fp(taskModule, { name: "task-module" });
