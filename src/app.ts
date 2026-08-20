import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { loggerFor } from "./lib/logger.js";
import databasePlugin from "./plugins/database.js";
import errorHandlerPlugin from "./plugins/error-handler.js";
import securityPlugin from "./plugins/security.js";
import swaggerPlugin from "./plugins/swagger.js";
import { healthModule } from "./modules/health/index.js";
import { onboardingModule } from "./modules/onboarding/index.js";
import taskModule from "./modules/task/index.js";
import userModule from "./modules/user/index.js";
import type { AppConfig } from "./config.js";
import type { FastifyInstance } from "fastify";

/**
 * The application's composition root. Everything the app is made of is
 * registered here, in an order you can read top to bottom: infrastructure
 * plugins, then publisher modules (they decorate the instance with their
 * services and mount their own prefixes), then consumer modules.
 *
 * Config comes in as a value, so tests can build the app with any
 * configuration (see test/int/helpers/build-test-app.ts) — no environment
 * mutation, no mocking.
 */
export const buildApp = async (config: AppConfig): Promise<FastifyInstance> => {
    const app = Fastify({
        logger: loggerFor(config.NODE_ENV),
    });

    app.decorate("config", config);

    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    await app.register(errorHandlerPlugin);
    await app.register(databasePlugin);
    await app.register(securityPlugin);
    await app.register(swaggerPlugin);

    // Publishers first — consumers below read their decorations.
    await app.register(userModule); //  mounts /api/users
    await app.register(taskModule); //  mounts /api/tasks

    await app.register(healthModule, { prefix: "/health" });
    await app.register(onboardingModule, { prefix: "/api/onboarding" });

    await app.ready();

    return app;
};
