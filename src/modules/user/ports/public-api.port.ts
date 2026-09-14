export type UserPublicApi = {
    markOnboarded: (userId: number) => Promise<{ id: number; name: string }>;
};
