/**
 * CONSUMER-OWNED PORTS — the heart of cross-module communication.
 *
 * Onboarding needs two capabilities that other modules own. It does NOT
 * import their services or entities (modules-are-islands forbids it).
 * Instead it declares, here, in its own vocabulary, the narrow slice it
 * actually uses. The real `userService` / `taskService` decorations satisfy
 * these types STRUCTURALLY — TypeScript checks the fit at the wiring line in
 * index.ts, with no shared interface file and no import between modules.
 *
 * Payoff: the user module can evolve freely; this module only breaks when a
 * field it genuinely uses changes — which is exactly when it should break.
 * And unit tests fake these ports in five lines.
 */
export type UserOnboarder = {
    markOnboarded: (userId: number) => Promise<{ id: number; name: string }>;
};

export type TaskCreator = {
    createTask: (input: { title: string }) => Promise<{ id: number }>;
};
