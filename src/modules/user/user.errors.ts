import { ConflictError, NotFoundError } from "@/lib/errors.js";

export class UserNotFoundError extends NotFoundError {
    constructor() {
        super("User not found.");
    }
}

export class EmailTakenError extends ConflictError {
    constructor() {
        super("A user with this email already exists.");
    }
}

export class UserAlreadyOnboardedError extends ConflictError {
    constructor() {
        super("User has already completed onboarding.");
    }
}
