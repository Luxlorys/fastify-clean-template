/**
 * Outbound ports: capabilities this module needs from the outside world,
 * declared in the module's own vocabulary. Note what the type does NOT say:
 * no bucket, no key naming, no SDK — "where avatars live" is the adapter's
 * business (user.storage.s3.ts). The service and its unit tests only ever
 * see this type.
 */
export type AvatarStorage = {
    /** Stores the avatar bytes and returns the storage key to persist. */
    uploadAvatar: (input: {
        userId: number;
        body: Buffer;
        contentType: string;
    }) => Promise<string>;
};
