import { describe, expect, it } from "vitest";
import { createUserService } from "@/modules/user/user.service.js";
import {
    EmailTakenError,
    UserAlreadyOnboardedError,
    UserNotFoundError,
} from "@/modules/user/user.errors.js";
import { fixedClock } from "../helpers/fixed-clock.js";
import { createInMemoryUserRepository } from "../helpers/in-memory-user-repository.js";

const NOW = "2026-08-21T12:00:00Z";

const makeService = () => {
    const clock = fixedClock(NOW);
    const repository = createInMemoryUserRepository(clock);
    const service = createUserService({ repository, clock });

    return { service, repository };
};

describe("createUser", () => {
    it("persists and returns the user", async () => {
        const { service } = makeService();

        const user = await service.createUser({
            email: "andrei@example.com",
            name: "Andrei",
        });

        expect(user).toMatchObject({
            email: "andrei@example.com",
            name: "Andrei",
            onboardedAt: null,
        });
    });

    it("rejects a duplicate email with the port's contract error", async () => {
        const { service } = makeService();

        await service.createUser({ email: "a@example.com", name: "First" });

        await expect(
            service.createUser({ email: "a@example.com", name: "Second" }),
        ).rejects.toBeInstanceOf(EmailTakenError);
    });
});

describe("markOnboarded", () => {
    it("stamps the clock's time and persists it", async () => {
        const { service, repository } = makeService();
        const created = await service.createUser({
            email: "andrei@example.com",
            name: "Andrei",
        });

        const onboarded = await service.markOnboarded(created.id);

        expect(onboarded.onboardedAt).toEqual(new Date(NOW));
        expect(repository.rows()[0]?.onboardedAt).toEqual(new Date(NOW));
    });

    it("surfaces the domain rule on a second onboarding", async () => {
        const { service } = makeService();
        const created = await service.createUser({
            email: "andrei@example.com",
            name: "Andrei",
        });

        await service.markOnboarded(created.id);

        await expect(service.markOnboarded(created.id)).rejects.toBeInstanceOf(
            UserAlreadyOnboardedError,
        );
    });

    it("throws UserNotFoundError for an unknown id", async () => {
        const { service } = makeService();

        await expect(service.markOnboarded(999)).rejects.toBeInstanceOf(
            UserNotFoundError,
        );
    });
});
