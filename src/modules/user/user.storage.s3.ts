import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { S3Client } from "@aws-sdk/client-s3";
import type { AvatarStorage } from "./user.ports.js";

/**
 * The S3 ADAPTER for the AvatarStorage port — the only module file that
 * speaks AWS. Key layout, content types and SDK commands are decided here;
 * swapping to GCS or the filesystem is a new adapter plus one changed line
 * in index.ts.
 *
 * Keys are unique per upload (uuid suffix), so re-uploads never overwrite
 * in-flight reads of the previous avatar; the current key lives on the user
 * row.
 */
export const createS3AvatarStorage = (
    s3: S3Client,
    bucket: string,
): AvatarStorage => ({
    uploadAvatar: async ({ userId, body, contentType }) => {
        const key = `avatars/${userId}/${randomUUID()}`;

        await s3.send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: body,
                ContentType: contentType,
            }),
        );

        return key;
    },
});
