import { z } from "zod";
import type { User } from "./user.entity.js";

export const createUserBodySchema = z.object({
    email: z.email().max(320),
    name: z.string().trim().min(1).max(100),
});

export const userParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const userResponseSchema = z.object({
    id: z.number().int(),
    email: z.string(),
    name: z.string(),
    onboardedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
});

export type UserResponse = z.infer<typeof userResponseSchema>;

export const toUserResponse = (user: User): UserResponse => ({
    id: user.id,
    email: user.email,
    name: user.name,
    onboardedAt: user.onboardedAt === null ? null : user.onboardedAt.toISOString(),
    createdAt: user.createdAt.toISOString(),
});
