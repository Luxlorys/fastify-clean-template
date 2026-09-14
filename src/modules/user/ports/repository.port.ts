import type { NewUser, User } from "../user.entity.js";

export type UserRepository = {
    create: (data: NewUser) => Promise<User>;
    findById: (id: number) => Promise<User | null>;
    save: (user: User) => Promise<User>;
};
