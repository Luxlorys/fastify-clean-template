import type { NewUser, User } from "./user.entity.js";

/**
 * The persistence PORT. `create` owns the uniqueness contract: it rejects
 * with EmailTakenError when the email is already used (every implementation
 * must honor that — the Prisma adapter translates P2002, the in-memory test
 * implementation checks its rows).
 */
export type UserRepository = {
    create: (data: NewUser) => Promise<User>;
    findById: (id: number) => Promise<User | null>;
    /** Persist the current state of an already-existing user. */
    save: (user: User) => Promise<User>;
};
