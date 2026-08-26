import { createOnboardingService } from "./onboarding.service.js";
import { onboardingRoutes } from "./onboarding.routes.js";
import type { FastifyPluginAsync } from "fastify";

/**
 * A CONSUMER module. It imports the user and task modules' *.contract.ts for
 * the types, and receives the implementations as decorations the publisher
 * modules put on the instance (app.ts registers them first).
 *
 * The decorations are already typed as those same contracts in
 * src/types/fastify.d.ts, so the two lines below are a plain, checked
 * assignment: if a contract changes, this stops compiling.
 */
export const onboardingModule: FastifyPluginAsync = async (fastify) => {
    const service = createOnboardingService({
        users: fastify.userService,
        tasks: fastify.taskService,
    });

    await fastify.register(onboardingRoutes(service));
};
