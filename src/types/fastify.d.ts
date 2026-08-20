import type { PrismaClient } from "@/generated/prisma/client.js";
import type { AppConfig } from "@/config.js";
import type { TaskService } from "@/modules/task/task.service.js";
import type { UserService } from "@/modules/user/user.service.js";

/**
 * The one place decorations are typed. This app-level file may import module
 * types (the boundary rules exempt it) — modules themselves still never
 * import each other: consumers read the decorations off the instance and
 * type them with their own ports.
 */
declare module "fastify" {
    interface FastifyInstance {
        config: AppConfig;
        prisma: PrismaClient;
        taskService: TaskService;
        userService: UserService;
    }
}
