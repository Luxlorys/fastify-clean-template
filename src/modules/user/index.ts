import fp from "fastify-plugin";
import { createPrismaUserRepository } from "./user.repository.prisma.js";
import { createS3AvatarStorage } from "./user.storage.s3.js";
import { createUserService } from "./user.service.js";
import { userRoutes } from "./user.routes.js";
import { systemClock } from "@/lib/clock.js";
import type { FastifyInstance } from "fastify";

/**
 * A PUBLISHER module: besides its own routes, it offers `userService` to
 * sibling modules as a decoration (typed in src/types/fastify.d.ts).
 *
 * Publishing changes the plugin's shape: the module is wrapped in
 * fastify-plugin so the decoration escapes encapsulation and reaches
 * siblings — and because fastify-plugin also disables prefixing, the module
 * mounts its own routes by registering them as an encapsulated child with
 * the prefix here (instead of receiving it from app.ts).
 */
const userModule = async (fastify: FastifyInstance) => {
    const repository = createPrismaUserRepository(fastify.prisma);

    const storage = createS3AvatarStorage(
        fastify.s3,
        fastify.config.S3_AVATARS_BUCKET,
    );

    const service = createUserService({ repository, storage, clock: systemClock });

    fastify.decorate("userService", service);

    await fastify.register(userRoutes(service), { prefix: "/api/users" });
};

export default fp(userModule, { name: "user-module" });
