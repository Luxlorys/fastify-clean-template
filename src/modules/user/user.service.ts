import { markOnboarded } from "./user.entity.js";
import { EmptyAvatarError, UserNotFoundError } from "./user.errors.js";
import type { User } from "./user.entity.js";
import type { UserService, UserServiceDeps } from "./user.ports.js";

export const createUserService = ({
    repository,
    avatars,
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

            const avatarKey = await avatars.uploadAvatar({
                userId: user.id,
                body,
                contentType,
            });

            return repository.save({ ...user, avatarKey });
        },
    };
};
