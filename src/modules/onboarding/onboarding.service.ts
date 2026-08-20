import type { TaskCreator, UserOnboarder } from "./onboarding.ports.js";

/**
 * A pure WORKFLOW module: it owns no tables and no entities — only the
 * orchestration of one user action across capabilities other modules own.
 * The business rules stay where they belong: "onboard only once" is enforced
 * by the user module (UserAlreadyOnboardedError propagates from there),
 * task-creation rules by the task module. Note there is no entity file here:
 * a module with no nouns of its own scales down to ports + service + routes.
 */
export type OnboardingResult = {
    userId: number;
    welcomeTaskId: number;
};

export type OnboardingService = {
    completeOnboarding: (userId: number) => Promise<OnboardingResult>;
};

export type OnboardingServiceDeps = {
    users: UserOnboarder;
    tasks: TaskCreator;
};

export const createOnboardingService = ({
    users,
    tasks,
}: OnboardingServiceDeps): OnboardingService => ({
    completeOnboarding: async (userId) => {
        const user = await users.markOnboarded(userId);

        const task = await tasks.createTask({
            title: `Welcome aboard, ${user.name} — create your first task`,
        });

        return { userId: user.id, welcomeTaskId: task.id };
    },
});
