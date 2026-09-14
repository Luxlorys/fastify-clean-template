import type { AvatarRepository } from "./avatar.port.js";
import type { UserRepository } from "./repository.port.js";
import type { CreateUserInput, SetAvatarInput, UserDto } from "../dto/user.dto.js";
import type { Clock } from "@/lib/clock.js";

export type UserService = {
    createUser: (input: CreateUserInput) => Promise<UserDto>;
    getUser: (id: number) => Promise<UserDto>;
    markOnboarded: (id: number) => Promise<UserDto>;
    setAvatar: (input: SetAvatarInput) => Promise<UserDto>;
};

export type UserServiceDeps = {
    repository: UserRepository;
    avatars: AvatarRepository;
    clock: Clock;
};
