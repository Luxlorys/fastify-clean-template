import { markOnboarded } from "./user.entity.js";
import { EmptyAvatarError, UserNotFoundError } from "./user.errors.js";
import type { NewUser, User } from "./user.entity.js";
import type { AvatarStorage } from "./user.ports.js";
import type { UserRepository } from "./user.repository.js";
import type { Clock } from "@/lib/clock.js";

export type SetAvatarInput = {
    id: number;
    body: Buffer;
    contentType: string;
};

export type UserService = {
    createUser: (input: NewUser) => Promise<User>;
    getUser: (id: number) => Promise<User>;
    /** Idempotency is a rule: onboarding a second time is a conflict. */
    markOnboarded: (id: number) => Promise<User>;
    /** Stores the avatar via the AvatarStorage port and persists its key. */
    setAvatar: (input: SetAvatarInput) => Promise<User>;
};

export type UserServiceDeps = {
    repository: UserRepository;
    storage: AvatarStorage;
    clock: Clock;
};

export const createUserService = ({
    repository,
    storage,
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

        setAvatar: async ({ id, body, contentType }) => {
            if (body.length === 0) {
                throw new EmptyAvatarError();
            }

            const user = await getUser(id);

            const avatarKey = await storage.uploadAvatar({
                userId: user.id,
                body,
                contentType,
            });

            return repository.save({ ...user, avatarKey });
        },
    };
};
