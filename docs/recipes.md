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

The 401 flows through the same error-handler as everything else. Sign tokens in
an `auth` module's service. To keep that service unit-testable, `fastify.jwt` is
an outbound dependency like any other: declare `TokenSigner` in
`auth/ports/token-signer.port.ts`, implement it in `auth.jwt.repository.ts`, and
wire it in `auth/index.ts` — the same three pieces as S3 and Redis below.

---

## 2. An outbound port implementation (object storage, mail, payments…)

This one lives in the code — the avatar upload in `modules/user` is the full
reference: **port in the consumer's vocabulary, the implementation owns the
SDK, the plugin owns the client lifecycle.**

- **Plugin**: `src/plugins/s3.ts` — client from config, `decorate("s3")`,
  destroy on close. Typed in `src/types/fastify.d.ts`.
- **Port**: `modules/user/ports/avatar.port.ts` — `AvatarRepository.uploadAvatar(...)`;
  purpose-named, zero SDK vocabulary. One `*.port.ts` file per role.
- **Implementation**: `modules/user/user.s3.repository.ts` — bucket, key
  layout, `PutObjectCommand`; the only module file importing `@aws-sdk/*`.
  A port implementation is named `<module>.<technology>.repository.ts` when it
  adapts a **store** (S3, Prisma, Redis, the filesystem) and
  `<module>.<technology>.service.ts` when it adapts an **external capability the
  module calls** and gets an answer from — recipe 2c. See
  [ADR-0010](adr/0010-ports-folder-and-service-adapters.md).
- **Wiring**: `modules/user/index.ts` —
  `createS3AvatarRepository(fastify.s3, config.S3_AVATARS_BUCKET)`.
- **Boundaries**: one row in the `ADAPTERS` table in
  `.dependency-cruiser.cjs`, which generates `s3-implementation-stays-below`
  and `s3-sdk-is-contained` — the storage twins of the Prisma rules:

    ```js
    {
        technology: "s3",
        family: "repository",
        sdk: "^node_modules/@aws-sdk",
        sdkAlsoIn: ["^src/plugins/s3\\.ts$"],
        alsoDependsOn: [],
        note: "...",
    }
    ```

- **Tests**: `test/helpers/in-memory-avatar-repository.ts` (unit lane),
  `test/int/user.s3.repository.test.ts` + `test/int/setup/minio.ts`
  (implementation contract against MinIO — a real S3 API, no AWS account
  needed).

To add another technology (a mail sender, a payment client), copy that
six-piece shape with a new file (`user.ses.repository.ts`) and its
`ADAPTERS` row. The port type, the factory and the dependency key
follow the filename: `MailRepository`, `createSesMailRepository`, `mail` — a
file renamed without its vocabulary is a half-done rename. Presigned URLs, when needed, are one more port method
(`signedReadUrl`) implemented in `user.s3.repository.ts` with
`@aws-sdk/s3-request-presigner`.

This recipe covers an integration **one module consumes**. When the same
SDK mechanics repeat across modules with no policy attached, share a pure
helper in `lib/` that only that technology's adapters may import — list it in
the row's `alsoDependsOn` and `sdkAlsoIn`.
The moment an integration owns behavior or state — retry, dedup, a queue,
suppression, webhooks — it is a capability, and it becomes a module of its
own publishing a `*PublicApi` (recipe 3). The decision rule is
[ADR-0009](adr/0009-third-party-integrations.md).

---

## 2b. Caching an entity (Redis)

Also in the code — read `modules/task`. Caching is exactly the
plugin/port/implementation shape above, with the cache as a **sibling of the
repository, never a wrapper around it**:

| Piece              | File                                    | Owns                                                                                                                                                                                                                    |
| ------------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Plugin**         | `src/plugins/redis.ts`                  | The client lifecycle only. `lazyConnect` so boot does not depend on Redis; `maxRetriesPerRequest: 1` so an outage costs one failure, not twenty retries; an `error` listener because an unhandled one is fatal in Node. |
| **Port**           | `modules/task/ports/cache.port.ts`      | `TaskCache.read/write/forget` — the module's words. No `get`, `set` or `expire`.                                                                                                                                        |
| **Implementation** | `modules/task/task.cache.repository.ts` | Key layout (`task:v1:<id>`), the TTL, the JSON codec with Date revival, and the failure policy. The only file importing `ioredis`.                                                                                      |
| **Policy**         | `modules/task/task.service.ts`          | Which use case may read a snapshot and which must not, and where invalidation happens. Holds both ports; imports no SDK.                                                                                                |

`index.ts` picks the two implementations and hands both to the service:

```ts
const repository = createPrismaTaskRepository(fastify.prisma);

const cache = createRedisTaskCache(fastify.redis, fastify.config.CACHE_TTL_SECONDS);

const service = createTaskService({ repository, cache, clock: systemClock });
```

There is no middle file between them. The cost is that each use case states
its own cache policy; the benefit is that the policy is readable where it
matters and a command can never be silently served a snapshot.

Six rules that carry the design:

- **Invalidate on the write path.** Every write goes through one `persist()`
  helper that saves and then calls `cache.forget()`. The failure mode of
  hand-rolled caching is always a write that busts nothing; giving the module
  one function that does both makes it hard to forget.
- **Never cache the read a write is derived from.** The service has two ways to
  read one task: `getTask` (a query — `cache.read` first, `repository.findById`
  on a miss) and the private `loadForUpdate` helper (a command's read — always
  `repository.findById`, never the cache). Use cases that read, apply a domain
  rule and then `save` must use the second. Busting on write is not enough on
  its own: a reader that missed can write its now-obsolete row into the cache
  _after_ a concurrent `save` has already called `forget`, and that entry then
  lives out the full TTL. A command reading it would judge its rules against a
  state that no longer exists —
  completing a task archived minutes ago — and then save the stale entity back,
  reverting every field it never saw change. A stale query is a cache working;
  a stale command is data loss. Regression tests live in
  `test/unit/task.service.test.ts` under "commands read the source of truth".
- **Never cache a list.** Cursor-paginated, filtered results mean one write
  invalidates an unbounded set of pages. Cache entities by id.
- **Version the key.** A blob outlives a deploy. Bump `v1` when the entity's
  shape changes; a blob that no longer parses is a miss, not a 500.
- **A cache outage degrades, it does not fail.** The implementation catches —
  not the service: `read` returns null and the request falls through to
  Postgres. Proved against a dead server in
  `test/int/task.cache.repository.test.ts`. A service that swallowed cache
  errors itself would hide a genuinely broken port implementation, so
  `test/unit/task.service.test.ts` pins that it does not.
- **The TTL bounds a lost invalidation.** `forget` is best effort — throwing
  would fail a request whose database write already committed. So
  `CACHE_TTL_SECONDS` is the worst-case staleness. If a use case needs
  guaranteed invalidation, it needs an outbox, not a bigger try/catch.

Tests: the caching policy has no test file of its own because it has no file of
its own — `test/unit/task.service.test.ts` covers it with two in-memory
implementations and no container (a counting repository makes a cache _hit_
observable). `test/int/task.cache.repository.test.ts` pins the implementation
contract against a real Redis — Date revival, TTL, a stale-shape blob, and the
outage path. When the port's semantics change, update the in-memory
implementation and the integration test together.

**Pub/sub and streams are a different recipe, not this one.** Publishing is an
outbound port like any other, but a subscriber is a _second entry point_ into
the app — it belongs beside routes in `index.ts`, translating a message into a
call on the module's own service. Two things to know before reaching for it:
Redis pub/sub has no persistence and no ack, so a subscriber that is down
during a deploy loses those messages permanently (use Streams with consumer
groups, or a real queue, for anything that must happen); and a subscribing
connection is blocked, so it needs `redis.duplicate()`, not the shared client.

---

## 2c. An external capability: mail, payments, an LLM (`*.<tech>.service.ts`)

No vendor ships with the template, but the shape is fixed. A `.repository.ts`
adapts something the module stores into and reads back; a `.service.ts` adapts a
capability the module **calls and gets an answer from**, and it is **transport
only** ([ADR-0012](adr/0012-no-policy-in-an-adapter.md)).

| Piece          | File                                        | Owns                                                                                                               |
| -------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Plugin**     | `src/plugins/<vendor>.ts`                   | The SDK client's lifecycle only. Typed in `src/types/fastify.d.ts`.                                                |
| **Port**       | `modules/<name>/ports/<capability>.port.ts` | One attempt in the module's words: `MailTransport.send(message)`, `SummaryGenerator.generate(input)`.              |
| **Adapter**    | `modules/<name>/<name>.<vendor>.service.ts` | Request format, prompts and model settings, stop reasons, the error chain. The only module file importing the SDK. |
| **Policy**     | `modules/<name>/<name>.service.ts`          | Preparing the input, validating the answer, the retry or correction budget, what gets recorded.                    |
| **Rules**      | `modules/<name>/<name>.entity.ts`           | The limits the answer is checked against, as constants, and a validator that returns **every** violation.          |
| **Boundaries** | one `ADAPTERS` row, `family: "service"`     | Generates `<vendor>-implementation-stays-below` and `<vendor>-sdk-is-contained`.                                   |

A vendor that can be asked to fix its own answer gets a port that returns an
attempt rather than an answer:

```ts
export type GenerationAttempt = {
    candidate: SummaryCandidate;
    usage: GenerationUsage;
    correct: (reasons: string[]) => Promise<GenerationAttempt>;
};

export type SummaryGenerator = {
    generate: (input: GenerateSummaryInput) => Promise<GenerationAttempt>;
};
```

The service runs the loop against a budget from config, and the vendor's
conversation stays inside the adapter's `correct` closure:

```ts
let attempt = await generator.generate(input);
let reasons = validateSummary(attempt.candidate);

for (let turn = 0; reasons.length > 0 && turn < maxCorrections; turn++) {
    attempt = await attempt.correct(reasons);
    reasons = validateSummary(attempt.candidate);
}

if (reasons.length > 0) {
    throw new SummaryInvalidError(reasons);
}
```

A vendor that cannot correct itself — mail, payments — gets the plain form:
`send` is one attempt, and the retry budget, backoff and dedup live in the
service in exactly the same place.

Rules that carry it:

- **Translate errors most-specific first, and keep the vendor's message.**
  Connection failures, 429 and 5xx become a module error subclassing
  `ServiceUnavailableError` (503); every other vendor error — a 400 from a bad
  parameter, a 401 — becomes a named rejection, so a misconfiguration is
  recorded as itself and not as an outage. Catch the SDK's base error class, not
  only its HTTP error: a client-side parse failure inside the SDK otherwise
  escapes past the stop-reason check and the correction turn.
- **Check the stop reason before parsing.** A truncated answer is a stop
  reason, not a JSON error.
- **Limits live once, in the entity.** A structured-output schema carrying
  `min`/`max` that the vendor does not enforce is validation in disguise; keep
  the adapter's schema shape-only and interpolate the entity's constants into
  the prompt.
- **Never split an adapter into helper files.** An implementation may not
  import a sibling or a helper, and a helper may not import the SDK. Shrink an
  adapter by moving non-vendor work up into the service.
- **A pure transformation the use case needs** (HTML → text, templating) is a
  `lib/` file added to `SERVICE_ALLOWED` in `.dependency-cruiser.cjs` — never to
  the adapter's `alsoDependsOn`. An adapter row exempting a non-vendor helper is
  the sign the adapter is doing the use case's work.
- **Tests.** There is no local vendor and no mocks, so the adapter itself runs
  only in production — which is why nothing but transport may live in it. The
  unit lane covers the pipeline with one shared stub in `test/helpers/` (a
  sequenced generator that returns a canned candidate per turn and records the
  reasons each `correct` received). For route tests, give `buildApp` a second
  `overrides` argument that the module's `index.ts` accepts in place of the
  real adapter, so the integration lane runs the real database with the stub.

---

## 3. A capability one module offers another

This one lives in the code, not just in this file — read the slice:

- **Published API**: `UserPublicApi`, alone in
  `src/modules/user/ports/public-api.port.ts` — the capability the module offers,
  as pure types over ids and plain inputs. That file is the only one in the folder
  another module may import, and because it holds nothing else, that is now a rule
  the tool enforces rather than one you have to remember. `TaskPublicApi` in
  `src/modules/task/ports/public-api.port.ts` is the second example.
- **Publisher**: `src/modules/user/index.ts` — builds its service, calls
  `fastify.decorate("userService", service)`, and is exported wrapped in
  `fastify-plugin` so the decoration escapes encapsulation and reaches
  siblings (which is also why it mounts its own `/api/users` prefix
  internally: fp-wrapped plugins don't receive one). `src/types/fastify.d.ts`
  types that decoration as **the published API, not the service** — which is
  what keeps `fastify.userService` from becoming a way into the whole module.
- **Consumer**: `src/modules/onboarding/` — names both published types in its
  own `ports/service.port.ts` and wires `fastify.userService` /
  `fastify.taskService` into its service in `index.ts`. The import is a real
  edge, so `npm run boundaries` checks it; the rest of those folders stays
  unreachable.
- **Order**: `app.ts` registers publishers before consumers.
- **Tests**: `test/unit/onboarding.service.test.ts` fakes each published API in
  five lines; `test/int/onboarding.test.ts` proves the wiring over HTTP.

Do **not** re-declare the provider's signature as a port of your own. An
outbound `*.port.ts` inverts infrastructure _you_ implement several ways;
`public-api.port.ts` publishes a capability _this_ module owns.
See [ADR-0006](adr/0006-module-contracts.md).

The enforcement is complete here: `modules-are-islands` admits only
`ports/public-api.port.ts` across a module border, so a sibling reaching for
`UserRepository` fails `npm run boundaries`
([ADR-0010](adr/0010-ports-folder-and-service-adapters.md)). What is still on
review is keeping entities _out_ of that file — the rule sees the path, not the
shape of the types.

If two modules keep growing shared surface, that is the signal they are one
module — merge them, or extract the shared core to `lib/`.

---

## 4. Transactions across repositories

Each port method is atomic today. When one use case must commit several writes
together, give the _port_ a transactional method rather than leaking an ORM
transaction into the service:

In `task/ports/repository.port.ts`, the port grows a use-case-shaped atomic
operation:

```ts
export type TaskRepository = {
    ...
    completeAndLog: (task: Task, entry: NewAuditEntry) => Promise<Task>;
};
```

`task.prisma.repository.ts` implements it with `prisma.$transaction`
internally, and the in-memory implementation in `test/helpers/` grows the same
method. If genuinely cross-repository workflows appear, introduce a `UnitOfWork`
port (`withTransaction(fn)`) whose implementation passes Prisma's transaction
client to repository factories — the service still sees only ports. Prefer the
first form until the second is undeniable.

---

## 5. Typed + validated JSON columns

A Prisma `Json` column must be both typed and validated — the previous
template's best rule, unchanged in spirit:

1. Model the column's shape as a Zod schema in the module's `*.schema.ts`;
   derive the type with `z.infer`.
2. Validate at the edge: the schema is part of the request body schema, so no
   unvalidated value can reach the service.
3. Type the column for Prisma (`prisma-json-types-generator`, pinned to the
   major matching your Prisma) so the rows in `*.prisma.repository.ts` come
   back typed instead of `JsonValue` — and map them into the domain type in
   `toX()` like any other field.

That `toX()` mapper is the natural checkpoint: nothing enters or leaves the row
unparsed. A cached entity needs the same treatment on its own side — see the
`parseTask` revival step in `task.cache.repository.ts`.

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
layer: wrap in the route (`return { data: toTaskResponse(dto) }`) and in the
response schema. Services keep returning DTOs — nothing below the
routes changes, which is the whole point.
