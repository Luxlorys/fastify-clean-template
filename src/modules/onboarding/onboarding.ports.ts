import type { TaskPublicApi } from "@/modules/task/task.ports.js";
import type { UserPublicApi } from "@/modules/user/user.ports.js";

export type OnboardingResult = {
    userId: number;
    welcomeTaskId: number;
};

export type OnboardingService = {
    completeOnboarding: (userId: number) => Promise<OnboardingResult>;
};

export type OnboardingServiceDeps = {
    users: UserPublicApi;
    tasks: TaskPublicApi;
};
