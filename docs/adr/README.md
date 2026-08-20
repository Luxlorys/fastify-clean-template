# Architecture Decision Records

The decisions that shape this template, with the alternatives they were chosen
over. Read these before proposing a structural change — if the context has
changed, supersede the ADR; don't quietly drift.

| #                                | Decision                                                            |
| -------------------------------- | ------------------------------------------------------------------- |
| [0001](0001-vertical-modules.md) | Vertical feature modules, layered inside                            |
| [0002](0002-no-di-container.md)  | Fastify-native composition instead of a DI container                |
| [0003](0003-ports-and-domain.md) | Real repository ports; domain as types + pure functions             |
| [0004](0004-errors.md)           | Domain errors without status codes; no message catalog; no envelope |
| [0005](0005-testing.md)          | Two test lanes; in-memory ports instead of mocks                    |
