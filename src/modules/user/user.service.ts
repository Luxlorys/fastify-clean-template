import { markOnboarded } from "./user.entity.js";
import { UserNotFoundError } from "./user.errors.js";
import type { NewUser, User } from "./user.entity.js";
import type { UserRepository } from "./user.repository.js";
import type { Clock } from "@/lib/clock.js";

export type UserService = {
    createUser: (input: NewUser) => Promise<User>;
    getUser: (id: number) => Promise<User>;
    /** Idempotency is a rule: onboarding a second time is a conflict. */
    markOnboarded: (id: number) => Promise<User>;
};

export type UserServiceDeps = {
    repository: UserRepository;
    clock: Clock;
};

export const createUserService = ({
    repository,
    clock,
}: UserServiceDeps): UserService => {
    const getUser = async (id: number): Promise<User> => {
        const user = await repository.findById(id);

        if (user === null) {
            throw new UserNotFoundError();
        }

        return user;
    };

    return {
        createUser: async (input) => repository.create(input),

        getUser,

        markOnboarded: async (id) =>
            repository.save(markOnboarded(await getUser(id), clock.now())),
    };
};
