import { beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "./helpers/build-test-app.js";
import { createUser } from "./factories/user.factory.js";
import type { FastifyInstance } from "fastify";

describe("user routes", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        app = await buildTestApp();

        return async () => {
            await app.close();
        };
    });

    it("creates a user and returns 201 with the wire shape", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/users",
            body: { email: "andrei@example.com", name: "Andrei" },
        });

        expect(response.statusCode).toBe(201);
        expect(response.json()).toMatchObject({
            email: "andrei@example.com",
            name: "Andrei",
            onboardedAt: null,
        });
    });

    it("maps a duplicate email to 409 via the adapter's error translation", async () => {
        const existing = await createUser({ prisma: app.prisma });

        const response = await app.inject({
            method: "POST",
            url: "/api/users",
            body: { email: existing.email, name: "Impostor" },
        });

        expect(response.statusCode).toBe(409);
        expect(response.json()).toEqual({
            message: "A user with this email already exists.",
        });
    });

    it("rejects a malformed email with 400", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/users",
            body: { email: "not-an-email", name: "Andrei" },
        });

        expect(response.statusCode).toBe(400);
    });

    it("returns 404 for an unknown user", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/users/999999",
        });

        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({ message: "User not found." });
    });
});
