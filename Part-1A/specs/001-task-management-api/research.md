# Research: DayFlow Task Management API

**Date**: 2026-11-05
**Scope**: Resolve design choices for the Node.js/Express REST API, local JSON persistence, and
deterministic validation harness. No application code is produced by this research.

## Runtime and module system

**Decision**: Use a supported Node.js LTS release and JavaScript ES modules, explicitly declaring
`"type": "module"` in `package.json`. Use Express 5 and keep Express app construction separate from
listener startup.

**Rationale**: Explicit ESM package configuration avoids ambiguous module interpretation.
Separating app construction from the listener lets built-in tests start the API on an ephemeral
loopback port, then close it without a fixed-port conflict.

**Alternatives considered**: CommonJS is viable but conflicts with the requested ES modules.
Combining app creation and listener startup in one module makes test isolation and lifecycle cleanup
harder.

**Sources**: [Node.js packages](https://nodejs.org/api/packages.html#type),
[Node.js ECMAScript modules](https://nodejs.org/api/esm.html),
[Express 5 API](https://expressjs.com/en/5x/api/express/).

## Request parsing and validation

**Decision**: Parse JSON with Express's JSON middleware and an explicit, small request-body limit.
Treat parsed request objects as untrusted. Validate object shape, allowed fields, types, lengths,
status/priority enumerations, title, and tags before invoking business logic or writing state.

**Rationale**: Express explicitly warns that request body values are user-controlled. A bounded body
limits resource use; rejecting unknown or invalid fields prevents accidental state changes and
surprising partial acceptance.

**Alternatives considered**: Accepting arbitrary object keys or coercing invalid values makes
contracts less predictable and can hide mistakes; unbounded parsing is not appropriate for a
small task API.

**Sources**: [Express JSON middleware](https://expressjs.com/en/5x/api/express/#expressjson),
[OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html).

## JSON-file persistence and data integrity

**Decision**: Use a single-process JSON store. Distinguish a missing file (initialize an empty
store) from malformed JSON, invalid root shape, or invalid task records (fail startup and preserve
the file). Validate the complete candidate state before any write. Serialize in-process mutations.
Write a temporary file in the same directory and rename it over the data file only after the write
completes.

**Rationale**: Node's filesystem documentation warns that concurrent operations modifying the same
file are not synchronized. Serializing mutations avoids overlapping read-modify-write cycles.
Same-directory replacement limits exposure to partially written target data; this is not a
cross-process lock or a guarantee of crash durability on every filesystem. Refusing malformed
stored content avoids silently erasing the user's valid tasks.

**Alternatives considered**: Replacing malformed content with an empty list violates the data-loss
requirement. A database or multi-process locking layer would add complexity outside the specified
single-user, single-process scope. If concurrent processes or stronger durability become required,
revisit the storage decision through an approved specification/constitution change.

**Sources**: [Node.js filesystem promises API](https://nodejs.org/api/fs.html#promises-api),
[Node.js `rename`](https://nodejs.org/api/fs.html#fspromisesrenameoldpath-newpath).

## Deterministic IDs, timestamps, and ordering

**Decision**: Generate production task IDs with Node's cryptographic UUID facility and use ISO 8601
UTC timestamps. Inject the ID and clock sources at service construction for tests. If the injected
clock does not advance between successful updates, advance the stored update timestamp by the
smallest representable millisecond so a successful mutation still satisfies the specification.
Sort by priority High → Medium → Low, then creation timestamp ascending, then task ID in ascending
code-point order.

**Rationale**: Unique production IDs and current timestamps cannot be byte-identical across
independent runs. Injected deterministic sources make the same fixtures reproducible and prevent
sleep-based tests. The final ID key makes sorting total and stable when priorities and timestamps
tie.

**Alternatives considered**: Sleeping to observe a timestamp change is slow and flaky. Random
production identifiers cannot be fixed across executions; test injection preserves determinism
without weakening ID uniqueness. Leaving ties unspecified contradicts AC-07.

**Sources**: [Node.js crypto API](https://nodejs.org/api/crypto.html),
[Node.js test runner](https://nodejs.org/api/test.html).

## Test runner and API acceptance tests

**Decision**: Use `node:test`, `node:assert/strict`, the built-in `fetch`, and `node --test`.
Create isolated temporary JSON stores per test. Start the app on an ephemeral loopback port for
API acceptance tests and register cleanup for servers, stores, and directories.

**Rationale**: This meets the requested built-in test runner and avoids third-party HTTP test
dependencies. Isolation prevents order-dependent tests and accidental edits to user data.

**Alternatives considered**: A shared checked-in data file makes tests order-dependent and risks
data loss. An external test framework or remote service is unnecessary for the specified feature.

**Sources**: [Node.js test runner](https://nodejs.org/api/test.html),
[Node.js global `fetch`](https://nodejs.org/api/globals.html#fetch).

## Linting, syntax, and security gates

**Decision**: Use ESLint for linting, `node --check` for JavaScript syntax, dedicated local
security tests/static checks for request and file-access boundaries, and `node --test` for the
automated suite. Do not make an online dependency audit part of the acceptance gate.

**Rationale**: The constitution explicitly requires linting, security checks, tests, and repeatable
gates. `node --check` is a syntax check, not a linter, so ESLint is included. Online vulnerability
audits require a registry and are not deterministic/offline; the user's no-external-services
constraint favors local checks. Record tool versions and all gate diagnostics.

**Alternatives considered**: Calling `node --check` linting would misstate its coverage. Running an
online audit for every validation pass would introduce an external service dependency. The selected
local security checks do not claim to replace a full dependency-vulnerability audit.

**Sources**: [Node.js CLI `--check`](https://nodejs.org/api/cli.html#-c---check),
[ESLint](https://eslint.org/docs/latest/),
[npm audit](https://docs.npmjs.com/cli/v11/commands/npm-audit/),
[OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/).
