import { describe, expect, it } from "vitest";
import { createOnboardingService } from "@/modules/onboarding/onboarding.service.js";
import { UserAlreadyOnboardedError } from "@/modules/user/user.errors.js";
import type {
    TaskCreator,
    UserOnboarder,
} from "@/modules/onboarding/onboarding.ports.js";

/**
 * The consumer-port payoff in test form: the "user module" and "task module"
 * here are a few lines each, because the service depends on two tiny ports —
 * not on other modules, not on Fastify decorations, not on mocks.
 */
describe("completeOnboarding", () => {
    it("marks the user onboarded, then creates a personalized welcome task", async () => {
        const calls: string[] = [];

        const users: UserOnboarder = {
            markOnboarded: async (userId) => {
                calls.push(`onboard:${userId}`);

                return { id: userId, name: "Andrei" };
            },
        };

        const tasks: TaskCreator = {
            createTask: async ({ title }) => {
                calls.push(`task:${title}`);

                return { id: 77 };
            },
        };

        const service = createOnboardingService({ users, tasks });

        const result = await service.completeOnboarding(5);

        expect(result).toEqual({ userId: 5, welcomeTaskId: 77 });
        expect(calls).toEqual([
            "onboard:5",
            "task:Welcome aboard, Andrei — create your first task",
        ]);
    });

    it("propagates the user module's rule and creates no task", async () => {
        let taskCreated = false;

        const users: UserOnboarder = {
            markOnboarded: async () => {
                throw new UserAlreadyOnboardedError();
            },
        };

        const tasks: TaskCreator = {
            createTask: async () => {
                taskCreated = true;

                return { id: 1 };
            },
        };

        const service = createOnboardingService({ users, tasks });

        await expect(service.completeOnboarding(5)).rejects.toBeInstanceOf(
            UserAlreadyOnboardedError,
        );
        expect(taskCreated).toBe(false);
    });
});
