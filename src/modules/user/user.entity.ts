import { UserAlreadyOnboardedError } from "./user.errors.js";

export type User = {
    id: number;
    email: string;
    name: string;
    avatarKey: string | null;
    onboardedAt: Date | null;
    createdAt: Date;
};

export type NewUser = {
    email: string;
    name: string;
};

/**
 * Creation has no state- or time-dependent rules, so there is no draftUser()
 * — not every entity needs one. Onboarding does have a rule: it happens once.
 */
export const markOnboarded = (user: User, now: Date): User => {
    if (user.onboardedAt !== null) {
        throw new UserAlreadyOnboardedError();
    }

    return { ...user, onboardedAt: now };
};
