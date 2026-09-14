import type { OnboardingResultDto } from "../dto/onboarding-result.dto.js";
import type { TaskPublicApi } from "@/modules/task/ports/public-api.port.js";
import type { UserPublicApi } from "@/modules/user/ports/public-api.port.js";

export type OnboardingService = {
    completeOnboarding: (userId: number) => Promise<OnboardingResultDto>;
};

export type OnboardingServiceDeps = {
    users: UserPublicApi;
    tasks: TaskPublicApi;
};
