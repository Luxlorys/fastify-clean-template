# CLAUDE.md — Project rules for Claude Code

Fastify 5 + TypeScript backend template: pragmatic clean architecture in
vertical feature modules, Prisma 7 (PostgreSQL), Zod validation, no DI
container, boundaries enforced by dependency-cruiser.

Read [ARCHITECTURE.md](./ARCHITECTURE.md) for the design, [docs/adr/](./docs/adr/)
for why it is this way, [docs/recipes.md](./docs/recipes.md) before adding
auth, storage SDKs, transactions or JSON columns — the pattern you need is
probably specified there.

## Commands

```bash
npm run check        # typecheck + lint + boundaries + unit tests — run before saying you are done
npm run test:int     # integration tests (needs Docker running, nothing else)
npm run dev          # local server; DB via: docker compose up -d postgres

# Migrations: edit prisma/schema.prisma, then
npm run prisma:migrate:create   # writes SQL without applying — review it
npm run prisma:migrate:apply
```

## Hard rules

Most layering rules are _enforced_ — `npm run boundaries` fails on violations,
so work with the rules rather than around them. If a rule seems to block the
task, stop and ask; do not add exemptions to `.dependency-cruiser.cjs`.

1. **Follow the file roles.** Inside `src/modules/<name>/`: `*.entity.ts` /
   `*.errors.ts` (pure domain), `*.repository.ts` (port), `*.ports.ts`
   (outbound ports — other modules' capabilities, storage, …),
   `*.repository.prisma.ts` and `*.storage.s3.ts` (adapters), `*.service.ts`
   (use cases), `*.schema.ts` + `*.routes.ts` (interface), `index.ts`
   (wiring). The boundary rules match on these names — a file outside the
   convention silently escapes its layer's checks. A new adapter technology
   (Redis cache, mail, …) means a new role suffix plus its rules in
   `.dependency-cruiser.cjs`, mirroring the S3 pair.
   1a. **Cross-module use goes through decorations, never imports.** A module
   offering a capability publishes its service as a decoration (see
   `modules/user/index.ts` — fp-wrapped, mounts its own prefix, typed in
   `src/types/fastify.d.ts`). A module consuming one declares its own port in
   `*.ports.ts` and wires `fastify.<x>Service` in its `index.ts` (see
   `modules/onboarding`). Entities never cross module borders — ids and plain
   inputs do.
2. **SDKs only in adapters.** Prisma lives in `*.repository.prisma.ts` (plus
   `plugins/database.ts` and test factories); `@aws-sdk/*` lives in
   `*.storage.s3.ts` (plus `plugins/s3.ts`). Services never see SDK types;
   ports speak the module's vocabulary — purpose in the port
   (`uploadAvatar`), technology in the adapter (buckets, keys, commands).
3. **Services stay framework-free**: no Fastify, no Zod, no HTTP concepts, no
   status codes, no wire envelopes. Inputs/outputs are the service's own
   declared types.
4. **Errors**: throw named module errors from `*.errors.ts` subclassing
   `lib/errors.ts`. Never attach status codes outside
   `plugins/error-handler.ts`; never format error bodies in handlers.
5. **No mocking framework.** Unit tests substitute port _implementations_
   (in-memory repository, fixed clock) — extend those when a port grows.
   When a port's semantics change, update the adapter integration test AND
   the in-memory implementation together.
6. **Migrations only via `prisma:migrate:create`** — never hand-write or edit
   files under `prisma/migrations/` (exception: a backfill or custom SQL the
   schema cannot express, after the file is generated). Review generated SQL
   before applying; if it is destructive, stop and ask.
7. **Every list endpoint is paginated** (cursor pattern in `lib/pagination.ts`
   — copy the task module's `list`).
8. **Time comes from the Clock port** in services/entities — never
   `new Date()` there (routes/adapters may, for infrastructure purposes).
9. **New env vars** go into the Zod schema in `src/config.ts` (type is
   inferred — never hand-write a config type) and `.env.example`.
10. **Integration tests**: arrange with factories in `test/int/factories/`,
    never hardcode row ids (TRUNCATE restarts sequences — read ids off the
    factory's return), keep a multi-step journey inside a single `it`.

## Conventions

- ESM with NodeNext: relative imports end in `.js`; `@/` aliases `src/`.
- `import type` for type-only imports (`verbatimModuleSyntax` enforces it).
- Factory functions over classes everywhere except error types.
- Handlers are thin inline functions in `*.routes.ts` — parse is the schema's
  job, logic is the service's, mapping is `toXResponse`'s.
- Conventional Commits (commitlint enforces).
- No barrel files; a module's `index.ts` is its plugin/composition root, not
  a re-export hub.
- Adding a feature: follow ARCHITECTURE.md §6 inside-out; `modules/task/` is
  the reference slice. Copy its shape, including its four test files.
