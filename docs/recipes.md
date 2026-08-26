# Recipes

Patterns the template deliberately ships as documentation instead of dead
code. A template earns trust by having every shipped line exercised by a test;
these are the additions real projects make on day one, written so they land
inside the architecture instead of beside it.

---

## 1. JWT authentication

Install `@fastify/jwt`, add `JWT_SECRET` to `src/config.ts`, then create
`src/plugins/auth.ts`:

```ts
import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import { UnauthorizedError } from "@/lib/errors.js";
import type { FastifyInstance, FastifyRequest } from "fastify";

const auth = async (fastify: FastifyInstance) => {
    await fastify.register(jwt, { secret: fastify.config.JWT_SECRET });

    fastify.decorate("authenticate", async (request: FastifyRequest) => {
        try {
            await request.jwtVerify();
        } catch {
            throw new UnauthorizedError("Missing or invalid access token.");
        }
    });
};

export default fp(auth, { name: "auth" });
```

Type the decoration and the token payload in `src/types/fastify.d.ts`:

```ts
declare module "fastify" {
    interface FastifyInstance {
        authenticate: (request: FastifyRequest) => Promise<void>;
    }
}

declare module "@fastify/jwt" {
    interface FastifyJWT {
        user: { sub: number };
    }
}
```

Save it as `src/plugins/auth.ts` — autoload picks it up, no registration
line to add. If it needs another plugin loaded first, name that plugin in
`fp(..., { dependencies: [...] })`. Then protect routes:

```ts
fastify.post("/", {
    onRequest: [fastify.authenticate],
    schema: { ... , response: { 401: errorResponseSchema } },
}, handler);
```

The 401 flows through the same error-handler as everything else. Sign tokens
in an `auth` module's service (`fastify.jwt.sign(...)` passed in as a
`TokenSigner` port if you want the service unit-testable).

---

## 2. An outbound adapter (object storage, mail, payments…)

This one lives in the code — the avatar upload in `modules/user` is the full
reference: **port in the consumer's vocabulary, adapter owns the SDK, plugin
owns the client lifecycle.**

- **Plugin**: `src/plugins/s3.ts` — client from config, `decorate("s3")`,
  destroy on close. Typed in `src/types/fastify.d.ts`.
- **Port**: `modules/user/user.ports.ts` — `AvatarStorage.uploadAvatar(...)`;
  purpose-named, zero SDK vocabulary.
- **Adapter**: `modules/user/user.storage.s3.ts` — bucket, key layout,
  `PutObjectCommand`; the only module file importing `@aws-sdk/*`.
- **Wiring**: `modules/user/index.ts` —
  `createS3AvatarStorage(fastify.s3, config.S3_AVATARS_BUCKET)`.
- **Boundaries**: `storage-adapter-stays-below` +
  `aws-sdk-only-in-storage-adapters` in `.dependency-cruiser.cjs` — the
  storage twins of the Prisma rules.
- **Tests**: `test/helpers/in-memory-avatar-storage.ts` (unit lane),
  `test/int/user.storage.s3.test.ts` + `test/int/setup/minio.ts` (adapter
  contract against MinIO — a real S3 API, no AWS account needed).

To add another technology (a mail sender, a payment client), copy that
six-piece shape with a new role suffix (`*.mailer.ses.ts`) and its
dependency-cruiser pair. Presigned URLs, when needed, are one more port method
(`signedReadUrl`) implemented in the adapter with
`@aws-sdk/s3-request-presigner`.

---

## 2b. Caching an entity (Redis)

Also in the code — read `modules/task`. Caching is the plugin/port/adapter
shape above **plus a decorator**, and the decorator is what keeps caching out
of the use cases:

| Piece         | File                                     | Owns                                                                                                                                                                                                                    |
| ------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Plugin**    | `src/plugins/redis.ts`                   | The client lifecycle only. `lazyConnect` so boot does not depend on Redis; `maxRetriesPerRequest: 1` so an outage costs one failure, not twenty retries; an `error` listener because an unhandled one is fatal in Node. |
| **Port**      | `modules/task/task.ports.ts`             | `TaskCache.read/write/forget` — the module's words. No `get`, `set` or `expire`.                                                                                                                                        |
| **Adapter**   | `modules/task/task.cache.redis.ts`       | Key layout (`task:v1:<id>`), the TTL, the JSON codec with Date revival, and the failure policy. The only file importing `ioredis`.                                                                                      |
| **Decorator** | `modules/task/task.repository.cached.ts` | Read-through logic. Implements `TaskRepository`, wraps a `TaskRepository` and a `TaskCache`. Imports no SDK.                                                                                                            |

`index.ts` is the only place that knows caching happens:

```ts
const repository = createCachedTaskRepository(
    createPrismaTaskRepository(fastify.prisma),
    createRedisTaskCache(fastify.redis, fastify.config.CACHE_TTL_SECONDS),
);
```

Delete those two wrapper lines and the module is uncached — the service,
routes and tests do not change. That is the reason to prefer a decorator over
an `if (cached)` inside a use case.

Five rules that carry the design:

- **Invalidate on the write path.** `save()` calls `forget()`. The failure mode
  of hand-rolled caching is always a write that busts nothing; putting the bust
  in the same function as the write makes it hard to forget.
- **Never cache a list.** Cursor-paginated, filtered results mean one write
  invalidates an unbounded set of pages. Cache entities by id.
- **Version the key.** A blob outlives a deploy. Bump `v1` when the entity's
  shape changes; a blob that no longer parses is a miss, not a 500.
- **A cache outage degrades, it does not fail.** The adapter catches: `read`
  returns null and the request falls through to Postgres. Proved against a dead
  server in `test/int/task.cache.redis.test.ts`.
- **The TTL bounds a lost invalidation.** `forget` is best effort — throwing
  would fail a request whose database write already committed. So
  `CACHE_TTL_SECONDS` is the worst-case staleness. If a use case needs
  guaranteed invalidation, it needs an outbox, not a bigger try/catch.

Tests: `test/unit/task.repository.cached.test.ts` covers the caching logic with
two in-memory implementations and no container (a counting repository makes a
cache _hit_ observable); `test/int/task.cache.redis.test.ts` pins the adapter
contract against a real Redis — Date revival, TTL, a stale-shape blob, and the
outage path. When the port's semantics change, update the in-memory
implementation and the adapter test together.

**Pub/sub and streams are a different recipe, not this one.** Publishing is an
outbound port like any other, but a subscriber is a _second entry point_ into
the app — it belongs beside routes in `index.ts`, translating a message into a
call on the module's own service. Two things to know before reaching for it:
Redis pub/sub has no persistence and no ack, so a subscriber that is down
during a deploy loses those messages permanently (use Streams with consumer
groups, or a real queue, for anything that must happen); and a subscribing
connection is blocked, so it needs `redis.duplicate()`, not the shared client.

---

## 3. A capability one module offers another

This one lives in the code, not just in this file — read the slice:

- **Contract**: `src/modules/user/user.contract.ts` — the capability the module
  offers, as pure types over ids and plain inputs. The only file in that folder
  another module may import. `src/modules/task/task.contract.ts` is the second
  example.
- **Publisher**: `src/modules/user/index.ts` — builds its service, calls
  `fastify.decorate("userService", service)`, and is exported wrapped in
  `fastify-plugin` so the decoration escapes encapsulation and reaches
  siblings (which is also why it mounts its own `/api/users` prefix
  internally: fp-wrapped plugins don't receive one). `src/types/fastify.d.ts`
  types that decoration as **the contract, not the service** — which is what
  keeps `fastify.userService` from becoming a way into the whole module.
- **Consumer**: `src/modules/onboarding/` — imports the two contract types
  directly and wires `fastify.userService` / `fastify.taskService` into its
  service in `index.ts`. The import is a real edge, so `npm run boundaries`
  checks it; everything else in those folders stays unreachable.
- **Order**: `app.ts` registers publishers before consumers.
- **Tests**: `test/unit/onboarding.service.test.ts` fakes each contract in five
  lines; `test/int/onboarding.test.ts` proves the wiring over HTTP.

Do **not** re-declare the provider's signature in the consumer's `*.ports.ts`.
Ports invert outbound infrastructure you implement several ways; contracts
publish a capability another module owns. See [ADR-0006](adr/0006-module-contracts.md).

If two modules keep growing shared surface, that is the signal they are one
module — merge them, or extract the shared core to `lib/`.

---

## 4. Transactions across repositories

Each port method is atomic today. When one use case must commit several writes
together, give the _port_ a transactional method rather than leaking an ORM
transaction into the service:

```ts
// the port grows a use-case-shaped atomic operation
export type TaskRepository = {
    ...
    completeAndLog: (task: Task, entry: NewAuditEntry) => Promise<Task>;
};
```

The adapter implements it with `prisma.$transaction` internally. If genuinely
cross-repository workflows appear, introduce a `UnitOfWork` port
(`withTransaction(fn)`) whose adapter passes Prisma's transaction client to
repository factories — the service still sees only ports. Prefer the first
form until the second is undeniable.

---

## 5. Typed + validated JSON columns

A Prisma `Json` column must be both typed and validated — the previous
template's best rule, unchanged in spirit:

1. Model the column's shape as a Zod schema in the module's `*.schema.ts`;
   derive the type with `z.infer`.
2. Validate at the edge: the schema is part of the request body schema, so no
   unvalidated value can reach the service.
3. Type the column for Prisma (`prisma-json-types-generator`, pinned to the
   major matching your Prisma) so the adapter's rows come back typed instead
   of `JsonValue` — and map them into the domain type in `toX()` like any
   other field.

The adapter's mapper is the natural checkpoint: nothing enters or leaves the
row unparsed.

---

## 6. Production logging on GCP

Cloud Logging reads `severity`, not pino's numeric `level`. Extend
`lib/logger.ts`'s production branch:

```ts
case "production":
    return {
        level: "info",
        messageKey: "message",
        formatters: {
            level(label) {
                const severity: Record<string, string> = {
                    trace: "DEBUG", debug: "DEBUG", info: "INFO",
                    warn: "WARNING", error: "ERROR", fatal: "CRITICAL",
                };
                return { severity: severity[label] ?? "DEFAULT" };
            },
        },
        timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    };
```

---

## 7. A success envelope, if a client contract demands one

Envelopes are a wire-format decision, so they live entirely in the interface
layer: wrap in the route (`return { data: toTaskResponse(task) }`) and in the
response schema. Services keep returning domain objects — nothing below the
routes changes, which is the whole point.
