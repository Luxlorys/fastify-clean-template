export type OnboardingResultDto = {
    userId: number;
    welcomeTaskId: number;
};

export const toOnboardingResultResponse = (dto: OnboardingResultDto) => ({
    userId: dto.userId,
    welcomeTaskId: dto.welcomeTaskId,
});
