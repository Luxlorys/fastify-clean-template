# ADR-0011 — A `dto/` folder per module: one transfer model per file, type and mappings together

## Status

Accepted. Supersedes the "each module declares its boundary types in
`*.ports.ts`" bullet of [ADR-0008](0008-dto-at-the-application-boundary.md) —
as the first draft of [ADR-0010](0010-ports-folder-and-service-adapters.md)
carried it forward into `ports/dto.port.ts` and the input types in
`ports/service.port.ts` — and replaces the single `<module>.dto.ts` mapping file.
Everything else ADR-0008 decided — services return DTOs, routes map both ways,
the DTO file stays plain TypeScript, DTOs carry `Date`s — still stands.

## Context

ADR-0008 put the transfer types in the ports file and the mappings in
`<module>.dto.ts`, on the reasoning that ports hold types and `*.dto.ts` earns
its place as behaviour. Breaking the ports file apart by role would have kept
that split as `ports/dto.port.ts`.

Three things were wrong with the result, all observed in an application built
from this template.

**1. `dto.port.ts` is not a port.** Every other file under `ports/` inverts an
outbound dependency the module owns several implementations of, or publishes a
capability. A DTO file does neither: it holds the models the service returns,
has exactly one implementation — the mapper next door — and inverts nothing. It
would sit in `ports/` only because ADR-0007 ruled that every type a module owns
lives in one place, and the folder's own guarantee — "a file under `ports/`
names something the module needs from outside or offers to siblings" — would be
false for it.

**2. The type was never next to the mapping that produces it.** Adding a field
to `TaskDto` meant editing the ports file, then `task.dto.ts` for `toTaskDto`,
then `task.dto.ts` again for `toTaskResponse` — three edits in two files for
one decision. In a language with classes a DTO carries its own `to` and `from`;
the TypeScript equivalent is the module scope, and splitting the type from its
mappings gave up the only cohesion the pattern has.

**3. One mapping file per module does not scale.** A module with four transfer
models — an entity, its list item, a related record and a computed result —
grew a 285-line `<module>.dto.ts` with no internal boundary a reader could use.

The types could not simply move into `<module>.dto.ts` because of a cycle:
`service.port.ts` names the DTOs (they are its return types) and the mapping file
names the inputs (they are what `toXInput` produces), so merging them yields
`service.port.ts → task.dto.ts → service.port.ts`, which fails `no-circular` and
`port-is-types-only`. A separate DTO types file existed only to break that cycle —
a reason for a file to exist, but not one anyone can read off the folder.

## Decision

- **Every transfer model gets its own file under `src/modules/<name>/dto/`,
  holding the type and all its mappings**: `dto/task.dto.ts`,
  `dto/user.dto.ts`, `dto/onboarding-result.dto.ts`. A file is named after the
  model, not the module — the module is already in the path.

- **A DTO file owns both directions of its model**: the `<Name>Dto` type, the
  input type the use case accepts, `toXInput` (wire → input), `toXDto`
  (domain → DTO) and `toXResponse` (DTO → wire). Helpers used by one model stay
  unexported in the file that needs them.

- **The service's input types move out of `service.port.ts` with their DTOs.**
  This dissolves the cycle rather than working around it: `dto/*.dto.ts` imports
  the entity and nothing else in the module, and `service.port.ts` imports the
  DTO files. `service.port.ts` holds exactly the `<Name>Service` interface and
  its `Deps` — a signature written in a vocabulary declared elsewhere.

- **The layer order inside a module gains a rung**, and `dto/` sits below
  `ports/`, not inside it:

    ```
    entity/errors  →  dto/  →  ports/  →  service  →  routes/schema
    ```

- **`DTO_ALLOWED` does not admit `ports/`.** A DTO file may import the domain,
  its sibling DTO files and pure lib.

- **`PORT_ALLOWED` admits `dto/*.dto.ts`**, which is how `service.port.ts` names
  what the service takes and returns.

- **`IMPLEMENTATION_ALLOWED` deliberately excludes `dto/`.** An adapter speaks
  entities, because that is the vocabulary its port is written in; a repository
  that returned a DTO would be answering a question the service did not ask. The
  route ↔ service hop is the one that needs a transfer model — the
  service ↔ repository hop does not, and now cannot.

- `modules-are-islands` needs no change: `dto/` is inside the module, so a
  transfer model still cannot cross a border. Only `public-api.port.ts` may.

- **No barrel**, for the same reason ADR-0010 rejects `ports/index.ts`.

## Consequences

- **One decision is one edit.** Adding a field to the API means editing the
  entity, then one DTO file; the three hops that field travels through are
  consecutive lines in it.
- **`ports/` means one thing.** Every file under it names something the module
  needs from outside or offers to siblings.
- **A module with one transfer model gets a folder holding one file.** Every
  module in the template is that case today. The cost is the same one `ports/`
  already pays, paid to keep one shape across every module.
- **"Where is this declared" is answered by the model, not the role.** A reader
  looking for `OnboardingResultDto` opens `dto/onboarding-result.dto.ts`.
- **The cycle is structurally impossible rather than avoided by convention.**
  `DTO_ALLOWED` excluding `ports/` makes the direction explicit.

## Alternatives rejected

- **Fold the DTO types into `service.port.ts`.** Cheapest, no rule changes, and
  `service.port.ts` would state the full signature. Rejected: it solves "not a
  port" and neither of the other two — types still sit apart from their mappings,
  and the mapping file still grows without bound.
- **Keep one `<module>.dto.ts` and move the types into it.** Works for a module
  with one model. Rejected because it produces the single large file the split
  was meant to fix as soon as a module has several.
- **Split by direction — `dto/task.input.ts` and `dto/task.dto.ts`.** Also
  breaks the cycle. Rejected because `toCreateTaskInput` and `toTaskResponse`
  describe the same model's edge and would live in different files.
- **Let `dto/` import `ports/` "just in case".** Rejected: the point of moving
  the inputs is that the dependency has one direction, and an open door lets a
  repository query type drift into a wire contract.
