/**
 * The user module's PUBLIC API — the one file other modules may import.
 *
 * Everything else in this folder is private: the entity, the service type, the
 * repository port, the adapters. A sibling module that needs a user capability
 * imports this type and nothing else, so the dependency is a real import edge
 * that `npm run boundaries` can see and check.
 *
 * Two rules keep it a contract rather than a leak:
 *
 * - **Plain data only.** Ids and primitives cross the border, never `User` —
 *   adding a column here must not ripple into modules that never asked for it.
 * - **Narrow on purpose.** Publish the capability a consumer genuinely needs,
 *   not the whole service. `src/types/fastify.d.ts` types the decoration as
 *   this type, so this file is also the limit of what any code in the app can
 *   reach through `fastify.userService`.
 */
export type UserPublicApi = {
    /** Marks the user onboarded. Onboarding twice is a conflict, raised here. */
    markOnboarded: (userId: number) => Promise<{ id: number; name: string }>;
};
