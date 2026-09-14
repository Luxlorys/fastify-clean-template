import type { User } from "../user.entity.js";

export type CreateUserInput = {
    email: string;
    name: string;
};

export type SetAvatarInput = {
    id: number;
    body: Buffer;
    contentType: string;
};

export type UserDto = {
    id: number;
    email: string;
    name: string;
    avatarKey: string | null;
    onboardedAt: Date | null;
    createdAt: Date;
};

export const toCreateUserInput = (body: {
    email: string;
    name: string;
}): CreateUserInput => ({
    email: body.email,
    name: body.name,
});

export const toSetAvatarInput = (
    id: number,
    body: Buffer,
    contentType: string,
): SetAvatarInput => ({
    id,
    body,
    contentType,
});

export const toUserDto = (user: User): UserDto => ({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarKey: user.avatarKey,
    onboardedAt: user.onboardedAt,
    createdAt: user.createdAt,
});

export const toUserResponse = (dto: UserDto) => ({
    id: dto.id,
    email: dto.email,
    name: dto.name,
    avatarKey: dto.avatarKey,
    onboardedAt: dto.onboardedAt === null ? null : dto.onboardedAt.toISOString(),
    createdAt: dto.createdAt.toISOString(),
});
