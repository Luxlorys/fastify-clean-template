import type { AvatarStorage } from "@/modules/user/user.ports.js";

/**
 * Genuine implementation of the AvatarStorage port: stores objects in a Map
 * and mirrors the adapter's key contract (unique key per upload, prefixed by
 * user id).
 */
export const createInMemoryAvatarStorage = (): AvatarStorage & {
    objects: () => Map<string, { body: Buffer; contentType: string }>;
} => {
    let counter = 0;
    const store = new Map<string, { body: Buffer; contentType: string }>();

    return {
        objects: () => new Map(store),

        uploadAvatar: async ({ userId, body, contentType }) => {
            const key = `avatars/${userId}/${counter++}`;

            store.set(key, { body, contentType });

            return key;
        },
    };
};
