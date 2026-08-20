import { describe, expect, it } from "vitest";
import { loadConfig } from "@/config.js";

describe("loadConfig", () => {
    it("applies defaults over a minimal environment", () => {
        const config = loadConfig({
            DATABASE_URL: "postgresql://localhost:5432/app",
        });

        expect(config).toMatchObject({
            NODE_ENV: "development",
            HOST: "0.0.0.0",
            PORT: 3000,
            RATE_LIMIT_MAX: 100,
        });
    });

    it("coerces numeric variables from strings", () => {
        const config = loadConfig({
            DATABASE_URL: "postgresql://localhost:5432/app",
            PORT: "8080",
        });

        expect(config.PORT).toBe(8080);
    });

    it("names every offending variable when validation fails", () => {
        expect(() => loadConfig({ PORT: "not-a-number" })).toThrow(/DATABASE_URL/);
        expect(() => loadConfig({ PORT: "not-a-number" })).toThrow(/PORT/);
    });
});
