/**
 * The architecture, enforced. This file is the TypeScript equivalent of
 * import-linter contracts: every layering rule in ARCHITECTURE.md exists
 * here as a rule that fails CI (`npm run boundaries`).
 *
 * Layer map inside a module (dependencies point downward only):
 *
 *   index.ts                 composition root — may see everything in the module
 *   *.routes.ts, *.schema.ts interface layer  — fastify + zod, calls the service
 *   *.service.ts             application      — entity + port + lib only
 *   *.repository.prisma.ts   adapter          — implements the port, owns Prisma
 *   *.repository.ts          port             — types only
 *   *.ports.ts               consumer ports   — types only (capabilities other modules publish)
 *   *.entity.ts, *.errors.ts domain           — pure TypeScript
 */

/** What domain files (entities, errors) may depend on: each other and the pure lib files. */
const DOMAIN_ALLOWED =
    "^src/modules/[^/]+/[^/]+\\.(entity|errors)\\.ts$|^src/lib/(errors|clock|pagination)\\.ts$";

/** What a service may depend on: the domain, ports (own + consumer), other services in its module, pure lib. */
const SERVICE_ALLOWED =
    "^src/modules/[^/]+/[^/]+\\.(entity|errors|repository|service|ports)\\.ts$|^src/lib/(errors|clock|pagination)\\.ts$";

/** What a port may depend on: the domain and pure lib types. */
const PORT_ALLOWED = DOMAIN_ALLOWED;

/** What an adapter may depend on: domain, port, the generated Prisma client, pure lib. */
const ADAPTER_ALLOWED =
    "^src/modules/[^/]+/[^/]+\\.(entity|errors|repository)\\.ts$|^src/generated/|^src/lib/(errors|clock|pagination)\\.ts$";

module.exports = {
    forbidden: [
        {
            name: "no-circular",
            severity: "error",
            comment: "Circular dependencies make change risky and tests slow.",
            from: { pathNot: "^src/generated" },
            to: { circular: true, pathNot: "^src/generated" },
        },
        {
            name: "domain-stays-pure",
            severity: "error",
            comment:
                "Entities and domain errors are plain TypeScript: no Fastify, no Zod, no Prisma, no plugins. " +
                "If a rule needs infrastructure, it belongs in the service; if it needs the wire format, in the schema.",
            from: { path: "^src/modules/[^/]+/[^/]+\\.(entity|errors)\\.ts$" },
            to: { pathNot: DOMAIN_ALLOWED },
        },
        {
            name: "service-sees-no-infrastructure",
            severity: "error",
            comment:
                "Services depend on ports and entities, never on Fastify, Zod, Prisma, adapters, routes or schemas. " +
                "This is what keeps use cases unit-testable with an in-memory repository.",
            from: { path: "^src/modules/[^/]+/[^/]+\\.service\\.ts$" },
            to: { pathNot: SERVICE_ALLOWED },
        },
        {
            name: "port-is-types-only",
            severity: "error",
            comment:
                "A repository port speaks the module's domain vocabulary only — no frameworks, no Prisma.",
            from: {
                path: "^src/modules/[^/]+/[^/]+\\.(repository|ports)\\.ts$",
            },
            to: { pathNot: PORT_ALLOWED },
        },
        {
            name: "adapter-stays-below",
            severity: "error",
            comment:
                "A Prisma adapter implements the port; it may not reach up into services, routes or schemas, " +
                "and it may not import Fastify.",
            from: { path: "^src/modules/[^/]+/[^/]+\\.repository\\.prisma\\.ts$" },
            to: { pathNot: ADAPTER_ALLOWED },
        },
        {
            name: "prisma-only-in-adapters",
            severity: "error",
            comment:
                "The generated Prisma client may be imported only by repository adapters, the database plugin, " +
                "the fastify type augmentation, and tests (factories seed through Prisma on purpose).",
            from: {
                pathNot:
                    "^src/modules/[^/]+/[^/]+\\.repository\\.prisma\\.ts$|^src/plugins/database\\.ts$|^src/types/fastify\\.d\\.ts$|^src/generated/|^test/",
            },
            to: { path: "^src/generated/" },
        },
        {
            name: "adapters-composed-only-at-the-root",
            severity: "error",
            comment:
                "Only a module's index.ts (its composition root) and tests may instantiate an adapter. " +
                "Everything else programs against the port.",
            from: { pathNot: "(^|/)index\\.ts$|^test/" },
            to: { path: "\\.repository\\.prisma\\.ts$" },
        },
        {
            name: "modules-are-islands",
            severity: "error",
            comment:
                "A module may not import another module's files. If module A needs module B's capability, " +
                "B's plugin decorates the Fastify instance (see docs/recipes.md) or the shared piece moves to lib.",
            from: { path: "^src/modules/([^/]+)/" },
            to: { path: "^src/modules/", pathNot: "^src/modules/$1/" },
        },
        {
            name: "lib-is-standalone",
            severity: "error",
            comment:
                "lib is shared by everything, so it may depend on nothing above itself.",
            from: { path: "^src/lib/" },
            to: { path: "^src/(modules|plugins)/|^src/(app|server)\\.ts$" },
        },
        {
            name: "plugins-do-not-reach-into-modules",
            severity: "error",
            comment:
                "Infrastructure plugins are module-agnostic; only app.ts composes modules.",
            from: { path: "^src/plugins/" },
            to: { path: "^src/modules/" },
        },
    ],
    options: {
        // Generated Prisma code is a black box: edges INTO it are checked
        // (prisma-only-in-adapters), its internals are not analyzed.
        doNotFollow: { path: "node_modules|^src/generated" },
        tsConfig: { fileName: "tsconfig.json" },
        // Count type-only imports as dependencies: an `import type` across a
        // boundary is still coupling.
        tsPreCompilationDeps: true,
    },
};
