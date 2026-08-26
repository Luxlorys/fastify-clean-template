/**
 * The task module's PUBLIC API — see modules/user/user.contract.ts for the
 * rules. Plain data in, plain data out: a consumer asks for a task by title
 * and gets back an id, never a `Task`.
 */
export type TaskPublicApi = {
    createTask: (input: { title: string }) => Promise<{ id: number }>;
};
