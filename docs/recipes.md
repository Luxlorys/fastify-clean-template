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

Register it in `app.ts` (before the modules), then protect routes:

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

To add another technology (a mail sender, a Redis cache, a payment client),
copy that six-piece shape with a new role suffix (`*.mailer.ses.ts`,
`*.cache.redis.ts`) and its dependency-cruiser pair. Presigned URLs, when
needed, are one more port method (`signedReadUrl`) implemented in the adapter
with `@aws-sdk/s3-request-presigner`.

---

## 3. A capability one module offers another

This one lives in the code, not just in this file — read the slice:

- **Publisher**: `src/modules/user/index.ts` — builds its service, calls
  `fastify.decorate("userService", service)`, and is exported wrapped in
  `fastify-plugin` so the decoration escapes encapsulation and reaches
  siblings (which is also why it mounts its own `/api/users` prefix
  internally: fp-wrapped plugins don't receive one). `src/modules/task/index.ts`
  is the second example. Decorations are typed in `src/types/fastify.d.ts`.
- **Consumer**: `src/modules/onboarding/` — declares the slice it needs as
  consumer-owned ports (`onboarding.ports.ts`, types only), and its
  `index.ts` wires `fastify.userService` / `fastify.taskService` into the
  service. TypeScript checks structurally, at those lines, that the published
  services satisfy the ports — zero imports between the module folders.
- **Order**: `app.ts` registers publishers before consumers.
- **Tests**: `test/unit/onboarding.service.test.ts` fakes each port in five
  lines; `test/int/onboarding.test.ts` proves the wiring over HTTP.

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
