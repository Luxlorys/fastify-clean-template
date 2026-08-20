import { createOnboardingService } from "./onboarding.service.js";
import { onboardingRoutes } from "./onboarding.routes.js";
import type { FastifyPluginAsync } from "fastify";

/**
 * A CONSUMER module. Look at what is absent: no import from modules/user or
 * modules/task anywhere in this folder. The dependencies arrive as runtime
 * values on the Fastify instance (decorated by the publisher modules, which
 * app.ts registers before this one).
 *
 * The two lines below are where TypeScript checks — structurally — that the
 * published services satisfy this module's own ports (onboarding.ports.ts).
 * If the user module ever changes a field onboarding relies on, THESE lines
 * stop compiling.
 */
export const onboardingModule: FastifyPluginAsync = async (fastify) => {
    const service = createOnboardingService({
        users: fastify.userService,
        tasks: fastify.taskService,
    });

    await fastify.register(onboardingRoutes(service));
};
