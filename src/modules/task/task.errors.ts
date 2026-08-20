import { ConflictError, NotFoundError, UnprocessableError } from "@/lib/errors.js";

/**
 * The task module's error vocabulary. Every error a task operation can raise
 * is named here, next to the domain that raises it — not in a global message
 * catalog. The HTTP status comes from the base class and is assigned in one
 * place (src/plugins/error-handler.ts); nothing in this module knows it.
 */
export class TaskNotFoundError extends NotFoundError {
    constructor() {
        super("Task not found.");
    }
}

export class DueDateInPastError extends UnprocessableError {
    constructor() {
        super("A task cannot be created with a due date in the past.");
    }
}

export class TaskAlreadyDoneError extends ConflictError {
    constructor() {
        super("Task is already completed.");
    }
}

export class TaskArchivedError extends ConflictError {
    constructor() {
        super("An archived task cannot be completed.");
    }
}
