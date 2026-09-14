export type AvatarRepository = {
    uploadAvatar: (input: {
        userId: number;
        body: Buffer;
        contentType: string;
    }) => Promise<string>;
};
