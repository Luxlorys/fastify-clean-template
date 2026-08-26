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
 *   *.storage.s3.ts          adapter          — implements a storage port, owns @aws-sdk
 *   *.cache.redis.ts         adapter          — implements a cache port, owns ioredis
 *   *.repository.cached.ts   port decorator   — wraps a port with another port; no SDK
 *   *.repository.ts          port             — types only
 *   *.ports.ts               outbound ports   — types only (storage, cache, mail — infrastructure)
 *   *.contract.ts            public API       — types only; the ONLY file other modules may import
 *   *.entity.ts, *.errors.ts domain           — pure TypeScript
 *
 * Ports and contracts are different jobs and must not be mixed:
 *   - a PORT inverts an outbound dependency the module owns several
 *     implementations of (S3, in-memory, …). The module declares what it needs.
 *   - a CONTRACT publishes a capability the module offers to siblings. The
 *     module declares what it gives. One definition, N consumers, one import
 *     edge this file can police.
 */

/** What domain files (entities, errors) may depend on: each other and the pure lib files. */
const DOMAIN_ALLOWED =
    "^src/modules/[^/]+/[^/]+\\.(entity|errors)\\.ts$|^src/lib/(errors|clock|pagination)\\.ts$";

/** What a service may depend on: the domain, its ports, other modules' published contracts, other services in its module, pure lib. */
const SERVICE_ALLOWED =
    "^src/modules/[^/]+/[^/]+\\.(entity|errors|repository|service|ports|contract)\\.ts$|^src/lib/(errors|clock|pagination)\\.ts$";

/** What a port may depend on: the domain and pure lib types. */
const PORT_ALLOWED = DOMAIN_ALLOWED;

/**
 * What a published contract may depend on: pure lib types only. Deliberately
 * narrower than a port — a contract crosses a module border, so it may not
 * reference the module's own entities. Ids and plain inputs cross, not `User`.
 */
const CONTRACT_ALLOWED = "^src/lib/(errors|clock|pagination)\\.ts$";

/** What an adapter may depend on: domain, port, the generated Prisma client, pure lib. */
const ADAPTER_ALLOWED =
    "^src/modules/[^/]+/[^/]+\\.(entity|errors|repository)\\.ts$|^src/generated/|^src/lib/(errors|clock|pagination)\\.ts$";

/** What a cache adapter may depend on: domain, its ports, ioredis, pure lib. */
const CACHE_ADAPTER_ALLOWED =
    "^src/modules/[^/]+/[^/]+\\.(entity|errors|repository|ports)\\.ts$|^src/lib/(errors|clock|pagination)\\.ts$|^node_modules/ioredis";

/**
 * What a port decorator may depend on: the ports it composes, the domain, pure
 * lib. Same purity as a service — a decorator that reached for an SDK would be
 * an adapter wearing the wrong name.
 */
const PORT_DECORATOR_ALLOWED =
    "^src/modules/[^/]+/[^/]+\\.(entity|errors|repository|ports)\\.ts$|^src/lib/(errors|clock|pagination)\\.ts$";

/** What a storage adapter may depend on: domain, its ports, the AWS SDK, pure lib (node builtins are exempted in the rule itself). */
const STORAGE_ADAPTER_ALLOWED =
    "^src/modules/[^/]+/[^/]+\\.(entity|errors|repository|ports)\\.ts$|^src/lib/(errors|clock|pagination)\\.ts$|^node_modules/@aws-sdk";

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
            name: "contract-is-types-only",
            severity: "error",
            comment:
                "A module's published contract is the one file siblings may import, so it must stay a " +
                "pure type declaration over ids and plain inputs: no frameworks, no Prisma, and no " +
                "entities — importing an entity here would drag the module's domain across the border.",
            from: { path: "^src/modules/[^/]+/[^/]+\\.contract\\.ts$" },
            to: { pathNot: CONTRACT_ALLOWED },
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
            name: "storage-adapter-stays-below",
            severity: "error",
            comment:
                "A storage adapter implements its port; it may not reach up into services, routes or " +
                "schemas, and it may not import Fastify or Prisma.",
            from: { path: "^src/modules/[^/]+/[^/]+\\.storage\\.s3\\.ts$" },
            to: { pathNot: STORAGE_ADAPTER_ALLOWED, dependencyTypesNot: ["core"] },
        },
        {
            name: "cache-adapter-stays-below",
            severity: "error",
            comment:
                "A cache adapter implements its port; it may not reach up into services, routes or " +
                "schemas, and it may not import Fastify or Prisma.",
            from: { path: "^src/modules/[^/]+/[^/]+\\.cache\\.redis\\.ts$" },
            to: { pathNot: CACHE_ADAPTER_ALLOWED, dependencyTypesNot: ["core"] },
        },
        {
            name: "port-decorator-stays-pure",
            severity: "error",
            comment:
                "A *.repository.cached.ts decorator composes ports and returns a port. It may not " +
                "import an SDK, an adapter, a service or a framework — that purity is what lets the " +
                "unit lane cover caching with no container.",
            from: { path: "^src/modules/[^/]+/[^/]+\\.repository\\.cached\\.ts$" },
            to: { pathNot: PORT_DECORATOR_ALLOWED },
        },
        {
            name: "redis-only-in-cache-adapters",
            severity: "error",
            comment:
                "ioredis may be imported only by *.cache.redis.ts adapters, the redis plugin " +
                "(client lifecycle), the fastify type augmentation, and tests. Everything else " +
                "programs against a port — the cache twin of prisma-only-in-adapters.",
            from: {
                pathNot:
                    "\\.cache\\.redis\\.ts$|^src/plugins/redis\\.ts$|^src/types/fastify\\.d\\.ts$|^test/",
            },
            to: { path: "^node_modules/ioredis" },
        },
        {
            name: "aws-sdk-only-in-storage-adapters",
            severity: "error",
            comment:
                "The AWS SDK may be imported only by *.storage.s3.ts adapters, the s3 plugin " +
                "(client lifecycle), the fastify type augmentation, and tests. Everything else " +
                "programs against a port — the storage twin of prisma-only-in-adapters.",
            from: {
                pathNot:
                    "\\.storage\\.s3\\.ts$|^src/plugins/s3\\.ts$|^src/types/fastify\\.d\\.ts$|^test/",
            },
            to: { path: "^node_modules/@aws-sdk" },
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
            to: {
                path: "\\.repository\\.prisma\\.ts$|\\.storage\\.s3\\.ts$|\\.cache\\.redis\\.ts$|\\.repository\\.cached\\.ts$",
            },
        },
        {
            name: "modules-are-islands",
            severity: "error",
            comment:
                "A module may import exactly one thing from another module: its *.contract.ts. Everything " +
                "else in that folder is private. The implementation still arrives as a decoration wired in " +
                "index.ts (see docs/recipes.md); the contract is only how its type crosses the border.",
            from: { path: "^src/modules/([^/]+)/" },
            to: {
                path: "^src/modules/",
                pathNot:
                    "^src/modules/$1/|^src/modules/[^/]+/[^/]+\\.contract\\.ts$",
            },
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
