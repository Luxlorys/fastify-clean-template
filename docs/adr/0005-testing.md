# ADR-0005 — Two test lanes; in-memory ports instead of mocks

## Status

Accepted.

## Context

The layering exists to make behavior testable at the right altitude. The
previous template had a strong integration lane (Testcontainers, one database
per worker, truncate between tests — carried over here nearly verbatim, it is
excellent) but almost nothing between "pure utility function" and "full stack
against Postgres", because services were inseparable from Prisma's API.

## Decision

Four altitudes, two lanes:

| Altitude         | Lane        | Substitutes                                  |
| ---------------- | ----------- | -------------------------------------------- |
| Domain rules     | unit        | nothing — pure functions                     |
| Use cases        | unit        | in-memory port implementations + fixed clock |
| Adapter contract | integration | real PostgreSQL                              |
| Wire contract    | integration | nothing — the real app via `inject()`        |

And one prohibition: **no mocking framework**. The unit lane substitutes
_implementations of ports_ (an in-memory repository honoring the same
ordering/cursor contract, a frozen clock), not method stubs. The template
ships zero `vi.mock`/`vi.fn` calls.

## Why

- Mock-based service tests assert "the service called the ORM like so" —
  they restate the implementation and break on refactors that preserve
  behavior. Port-implementation tests assert behavior ("creating then listing
  returns the task first") and survive refactors.
- The in-memory implementation is honest because the _adapter_ integration
  tests pin the same contract against the real database. The pair — fake
  verified against real — is what makes fast unit tests trustworthy.
- `buildApp(config)` taking config as a value lets integration tests exercise
  config-dependent behavior (docs auth on/off) by passing overrides, without
  env mutation or module mocking.

## Consequences

- Unit lane: zero infrastructure, ~200ms — the default inner loop
  (`npm run check`).
- Integration lane: needs Docker only; one throwaway Postgres per run, a
  migrated template database cloned per worker, TRUNCATE per test. Its
  conventions (factories, no hardcoded ids, journeys in one `it`) are
  documented in ARCHITECTURE.md §4 and CLAUDE.md.
- When a port gains semantics (new ordering, filters), extend **both** the
  in-memory implementation and the adapter tests; a drifting fake is the
  failure mode of this strategy.
