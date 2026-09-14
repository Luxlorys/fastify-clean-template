# ADR-0010 — A `ports/` folder per module, one file per role; external-capability adapters named `*.<tech>.service.ts`

## Status

Accepted. **Amended by [ADR-0011](0011-dto-folder-per-module.md)**, which moved
the transfer models and the service's input types out of `ports/`, and
**narrowed by [ADR-0012](0012-no-policy-in-an-adapter.md)**, which states what a
`*.<tech>.service.ts` may contain.

Supersedes the first bullet of [ADR-0007](0007-one-ports-file.md)'s Decision
("one `*.ports.ts` per module holds every abstract type it owns") and narrows
its second ("every port implementation is named
`<module>.<technology>.repository.ts`"). Everything else ADR-0007 decided —
implementations are siblings, the service owns the cache policy, the vocabulary
follows the filename — still stands. Amends
[ADR-0001](0001-vertical-modules.md) and [ADR-0003](0003-ports-and-domain.md)
(file roles, where port types live), and [ADR-0006](0006-module-contracts.md)
by restoring the enforced border it recorded as lost.

## Context

Two things went wrong with the file roles as ADR-0007 left them. Both surfaced
in an application built from this template, and both reproduce here.

**1. One `*.ports.ts` per module put unrelated types in one file, and cost an
enforceable rule.** ADR-0007 chose a single ports file on the argument that
"abstract type" is one idea. It is not: `TaskRepository` is a dependency the
module owns two implementations of, `TaskDto` is a transfer model the service
returns, and `TaskPublicApi` is a promise to sibling modules that must never
change casually. In a module with a handful of models the file passed 190
lines, and a reader looking for the published API had to know it lived at the
bottom.

The concrete cost was the enforcement gap ADR-0006 and ADR-0007 both recorded
and neither could close. `modules-are-islands` matches file paths, so with the
published API inside `*.ports.ts` it could check that `onboarding` imported
`task.ports.ts` but not which type it took from it. Importing `TaskRepository`
across the border — exactly the coupling the rule exists to prevent — passed.
Both ADRs wrote down the same escape hatch: split the public API into its own
file and restore its rule.

**2. `*.repository.ts` stopped describing the files it named.** An adapter for
an LLM call — an article goes in, a generated quiz comes back — became
`generation.anthropic.repository.ts` under ADR-0007. But a repository is a
collection you put things into and read back out of; that file stores nothing,
retrieves nothing and has no identity to fetch by. Every further integration —
mail, payments, search — would inherit a name that describes none of them.

**3. Each new technology meant hand-writing two rules.** `.dependency-cruiser.cjs`
carried a `<tech>-implementation-stays-below` and a `<tech>-only-in-…` rule per
technology, copied from the Prisma pair with the regexes edited. An adapter
named for a technology nobody had written rules for matched neither and was
policed only by the generic composition-root rule — its SDK could be imported
from anywhere.

## Decision

- **Every abstract type a module owns lives under `src/modules/<name>/ports/`,
  one `*.port.ts` file per role.**

    | File                                                   | Holds                                                       |
    | ------------------------------------------------------ | ----------------------------------------------------------- |
    | `repository.port.ts`                                   | the persistence port(s)                                     |
    | `cache.port.ts`                                        | the cache port                                              |
    | `<role>.port.ts` (`avatar.port.ts`, `mail.port.ts`, …) | each further outbound port, named for what it inverts       |
    | `service.port.ts`                                      | `<Name>Service` and `<Name>ServiceDeps`                     |
    | `public-api.port.ts`                                   | `<Name>PublicApi` — the only file another module may import |

    A new outbound dependency is a new file named after its role, not a section
    appended to an existing one. (As first drafted, this table also held a
    `dto.port.ts` and the service's input types; ADR-0011 moved both to `dto/`.)

- **`modules-are-islands` admits exactly `ports/public-api.port.ts` across a
  module border.** Taking a sibling's repository port or transfer model fails
  `npm run boundaries`.

- **Port implementations split into two families by the kind of dependency they
  invert.** `<module>.<technology>.repository.ts` adapts something the module
  **stores into and reads back** — Prisma, Redis, S3, the filesystem.
  `<module>.<technology>.service.ts` adapts an **external capability the module
  calls and gets an answer from** — a mail, payments or LLM provider. Both keep
  the technology in the middle, where the composition root shows it being
  chosen.

- **One dot means the application service, two dots mean an adapter.**
  `<module>.service.ts` is the module's use cases; `<module>.<tech>.service.ts`
  is an outbound adapter. `.dependency-cruiser.cjs` tells them apart with
  `[^/.]+` versus `[^/]+\.[^./]+`: `service-sees-no-infrastructure` matches only
  the one-dot form, so the application service still may not import an SDK. A
  file that is genuinely a use-case service must never carry a dot in its stem.

- **Technologies are registered in one `ADAPTERS` table**, one row per
  technology — its family, the SDK it owns, the plugin holding that client, and
  any extra path that adapter alone may reach for. The row generates
  `<tech>-implementation-stays-below` and `<tech>-sdk-is-contained`. A file
  named like an adapter whose technology has no row fails
  `adapter-technology-is-registered`.

- `IMPLEMENTATION_FILES` matches `\.[^./]+\.(repository|service)\.ts$`, so both
  families are bound by `implementations-composed-only-at-the-root` — including
  ones not written yet.

- **No barrel.** A `ports/index.ts` would restore the single import path and
  undo the enforced border.

## Consequences

- **The cross-module boundary is fully enforced.** The rule ADR-0006
  introduced and ADR-0007 downgraded to a convention is a rule again. What
  remains by hand is keeping entities _out of_ `public-api.port.ts`;
  dependency-cruiser sees the file, not the shape of the types in it.
- **"Where is this declared" costs one more guess than it did.** ADR-0007's
  strongest argument was that one file answers that question. Now a reader picks
  a file by role. The roles are named for what they invert and the folder listing
  is short, but this is a real cost, paid for the enforced border.
- **The filename says which kind of dependency is inverted.** A reader
  scanning a module sees a Prisma repository, a Redis repository and a vendor
  service, and knows which one makes a billable network call without opening it.
- **`.service.ts` now means two things, distinguished only by a dot.** This is
  the sharpest edge of the decision. An adapter misnamed without its technology
  segment is treated as an application service and fails the boundaries build;
  an application service with a dot in its stem silently escapes
  `service-sees-no-infrastructure`. The rules' comments say so where they are
  defined.
- **A new technology is one table row.** Rule names changed with it:
  `prisma-only-in-repositories`, `redis-only-in-cache-implementations` and
  `aws-sdk-only-in-s3-implementations` are now `prisma-sdk-is-contained`,
  `cache-sdk-is-contained` and `s3-sdk-is-contained`.

## Alternatives rejected

- **Keep one `*.ports.ts` and split out only `*.contract.ts`.** The escape hatch
  ADR-0006 and ADR-0007 both named, and it would close the enforcement gap on
  its own. Rejected because it fixes the border and leaves repository, cache,
  DTOs, the service and its inputs in one bag.
- **Name external-capability adapters `*.gateway.ts` or `*.client.ts`.** Both
  read well in isolation. Rejected because `.service.ts` already means "the
  thing that performs a capability", and a third suffix means a third rule
  family. The one-dot/two-dot distinction is the price of reusing the word.
- **Keep `*.repository.ts` as the generic word for "port implementation".**
  What ADR-0007 decided. It only holds while every port is persistence-shaped.
- **Keep hand-written rule pairs per technology.** Rejected: they drift, and a
  technology without its pair is unpoliced rather than rejected.
