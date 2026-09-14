export type TaskPublicApi = {
    createTask: (input: { title: string }) => Promise<{ id: number }>;
};
