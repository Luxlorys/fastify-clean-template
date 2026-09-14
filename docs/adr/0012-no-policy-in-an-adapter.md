# ADR-0012 — No policy in an external-capability adapter: the port is one attempt, the use case owns the pipeline

## Status

Accepted. Applies [ADR-0009](0009-third-party-integrations.md) — "a thin
transport port, one attempt, vendor errors translated to named module errors,
the policy in the service" — to every `*.<tech>.service.ts`, and narrows what
the adapter family introduced in
[ADR-0010](0010-ports-folder-and-service-adapters.md) may contain. Adds
`SERVICE_UNAVAILABLE` to the error vocabulary of
[ADR-0004](0004-errors.md).

## Context

ADR-0009 already said where policy belongs. An application built from this
template showed how an adapter drifts away from it anyway, and why the drift
is expensive.

Its LLM adapter — one call that turns an article into a quiz — grew into the
use case. Besides calling the model it extracted the article's text and
rejected articles with too little of it, planned how many questions to ask,
validated the answer against the domain rules, ran a repair loop, and mapped the
vendor's errors. Six jobs in one file, four of which any generator — a second
vendor, a local model, a test stub — would need identically.

**1. The most logic-dense file had no tests and could not get any.** ADR-0005
forbids mocks, and there is no local vendor to run an integration test against,
so an adapter only ever runs in production. With the pipeline inside it, the
stub generators in the unit lane skipped extraction, planning, validation and
repair entirely; the service's tests proved the bookkeeping and nothing about
the answer.

**2. The error handling hid real failures.** The SDK validated its own
structured-output schema client-side and rejected with its base error class on a
length violation or truncated JSON. The adapter caught only the SDK's HTTP error
class, so the rejection bypassed the stop-reason check and the repair turn, and
the use case recorded a generic "invalid output" with no reasons. The validator
threw on the first violation, so a repair turn was told one reason at a time.
Every HTTP error — a 400 from a bad parameter and a 401 included — became
"unavailable" with the vendor's message dropped.

**3. The rules had legitimised the leak.** The adapter's `ADAPTERS` row carried
an `alsoDependsOn` exemption for the text-extraction `lib/` file, and the layer
table in ARCHITECTURE.md listed it as something the adapter may import —
documenting an accident as a design.

Splitting the adapter into helper files was not available: an implementation
may not import a sibling or a helper
(`implementations-composed-only-at-the-root`, `<tech>-implementation-stays-below`)
and a helper may not import the SDK (`<tech>-sdk-is-contained`). The only
rule-compatible way to shrink an adapter is to move non-technology work up.

## Decision

- **The application service owns the pipeline.** Preparing the input, rejecting
  input the capability cannot use, planning, calling the port, validating the
  answer, spending a retry or correction budget, and summing usage across turns
  are the use case's, in `<module>.service.ts`, under the unit lane.
- **The port is one attempt.** For a vendor that cannot fix its own answer
  (mail, payments) the port method is one call and the service owns the retry.
  For a vendor that can (an LLM), the port returns an **attempt** — the parsed
  candidate, that turn's usage, and `correct(reasons)`, which yields the next
  attempt. The vendor's conversation stays inside that closure, so the service
  runs the loop without seeing an SDK type and a stub implements `correct` in
  three lines.
- **The entity owns the limits and reports every violation.** Limits are domain
  constants; the validator returns all reasons at once, so one correction turn
  can fix them all. The service throws a named error carrying the reasons when
  the budget is spent. The budget is a config value.
- **The adapter is transport.** It keeps the request format, prompts (limits
  interpolated from the entity), model settings, stop-reason handling and usage
  mapping. It checks the stop reason before parsing, keeps any schema it sends
  shape-only, and reports a shape problem as reasons rather than throwing from
  inside the SDK. It catches the SDK's base error class, not only its HTTP one.
- **Vendor errors are translated most-specific first, with the vendor's
  message kept.** Connection, rate-limit and 5xx failures become a module error
  subclassing the new `ServiceUnavailableError` (`SERVICE_UNAVAILABLE` → 503);
  any other vendor error becomes a named rejection, so a misconfigured request is
  recorded as itself rather than as an outage.
- **The rules follow.** A pure `lib/` transformation the use case needs is
  admitted in `SERVICE_ALLOWED`, never in an adapter row's `alsoDependsOn`.
  `alsoDependsOn` is for what the vendor call itself needs — a schema library
  the SDK's structured-output API takes, a stateless SDK helper (ADR-0009).

## Consequences

- **The pipeline is covered by the unit lane.** A shared stub in
  `test/helpers/` — a sequenced generator returning a canned candidate per turn
  and recording the reasons each `correct` received — proves input preparation,
  validation, the correction budget and usage accounting. The adapter is still
  untested, by design, but what remains in it is SDK-facing and small.
- **A port that returns a closure.** `correct` is a function on a value that
  crosses a port. This is the price of keeping the vendor transcript out of the
  service.
- **Adapters have a stated ceiling.** CLAUDE.md rule 2c, the ARCHITECTURE.md
  layer table and recipe 2c say what a `*.<tech>.service.ts` may not contain and
  why it cannot be split into helper files.
- **A new error code.** `SERVICE_UNAVAILABLE` joins the vocabulary; the
  error-handler maps it to 503.

## Alternatives rejected

- **Split the adapter into helper files** (`*.prompt.ts`, `*.schema.ts`,
  `*.errors.ts`). The boundary rules forbid it without exemptions, and it moves
  nothing: the use-case steps stay untestable and stay the adapter's.
- **Keep the repair loop in the adapter as "how this vendor is coaxed".** Any
  generator can take a correction turn; whether to spend another billable call
  is a budget, and budgets are policy. ADR-0009 already made this call for mail
  retries.
- **Keep length limits in the schema sent to the vendor.** When the vendor does
  not enforce them they are validation in disguise, duplicated against the wire
  schema and the prompt; one gate in the entity replaces three copies.
- **Map every vendor error to "unavailable".** Simple, and it turns every
  configuration mistake into an apparent outage with no cause recorded.
