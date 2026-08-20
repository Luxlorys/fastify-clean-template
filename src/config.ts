import { z } from "zod";

/**
 * The single source of truth for configuration. One validation system (Zod),
 * one derived type (z.infer) — the schema and the type can never drift apart.
 *
 * Config is parsed once at startup and passed into buildApp() as a plain
 * value, so tests can build an app with any config they like.
 */
const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    HOST: z.string().default("0.0.0.0"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1),
    DOCS_PASSWORD: z.string().min(1).optional(),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
});

export type AppConfig = z.infer<typeof envSchema>;

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => {
    const parsed = envSchema.safeParse(env);

    if (!parsed.success) {
        const issues = parsed.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; ");

        throw new Error(`Invalid environment configuration — ${issues}`);
    }

    return parsed.data;
};
