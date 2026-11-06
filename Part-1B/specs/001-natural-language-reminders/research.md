# Research: Natural Language Reminder API

## Project Fit

- **Decision**: Keep the existing JavaScript ES module project and installed
  Express 5, `@google/genai`, dotenv, and Zod packages. The current project test
  command uses Node's built-in test runner.
- **Rationale**: Reusing the existing manifest and test runner avoids redundant
  dependencies. The installed Google GenAI SDK documents Node.js 22 or later as its
  prerequisite; establish that as the supported runtime and verify it against the
  selected installed SDK version.
- **Alternatives considered**: Add a new test framework or restructure as a
  multi-package project. Neither is needed for this small service.
- **Sources**: [Project package.json](../../package.json);
  [Google GenAI SDK README](https://github.com/googleapis/js-genai/blob/main/README.md#prerequisites).

## Express JSON and Error Handling

- **Decision**: Use Express JSON parsing with a small explicit body-size limit,
  validate parsed bodies as untrusted input, and install one four-argument JSON
  error handler after routes. Delegate to Express if response headers have already
  been sent.
- **Rationale**: Express 5 forwards rejected promises from async route handlers to
  error middleware. The default parser limit is not a product requirement; an
  explicit limit and normalized parser failures keep the API response shape
  consistent.
- **Alternatives considered**: Per-route try/catch and generic default error
  responses. Central error mapping is more consistent; parser failures also need
  normalization.
- **Sources**: [Express error handling](https://expressjs.com/en/guide/error-handling/);
  [Express 5 API: express.json](https://expressjs.com/en/5x/api/express/#expressjson).

## Gemini Structured Output

- **Decision**: Keep Gemini calls server-side. Request JSON using SDK generation
  configuration (`responseMimeType: application/json` and a supported
  `responseSchema`), then separately parse and validate the returned JSON.
- **Rationale**: Provider schema guidance improves shape but cannot establish
  semantic correctness or replace local validation. Treat missing, blocked,
  malformed, and failed provider responses as explicit failures.
- **Alternatives considered**: Prompt-only free text or raw JSON Schema generation.
  Prompt-only output is less constrained; either SDK schema form still requires
  local validation.
- **Risks**: Verify installed SDK schema capabilities against the model and keep
  provider schema constructs simple. Do not assume retry behavior; bounded retries
  add latency and cost and are not needed for v1.
- **Sources**: [Google SDK structured-output sample](https://github.com/googleapis/js-genai/blob/main/sdk-samples/generate_content_with_response_schema.ts);
  [Google SDK API errors](https://github.com/googleapis/js-genai/blob/main/README.md#api-errors);
  [Gemini retry guidance](https://ai.google.dev/gemini-api/docs/troubleshooting#retry-strategy).

## Zod and Validation Boundaries

- **Decision**: Parse response JSON as unknown data, then run strict Zod validation
  before using any field. Use a discriminated parse result or explicit validation
  error mapping, and run independent calendar/timezone/invariant checks afterward.
- **Rationale**: Zod's parse/safe-parse validates runtime values; model-side
  generation constraints do not validate actual received data. Its ISO string
  checks are not a timezone/DST engine.
- **Alternatives considered**: Trust SDK structured output or validate only
  primitive types. Neither is sufficient for the required schema and reminder
  invariants.
- **Sources**: [Zod basics](https://zod.dev/basics);
  [Zod ISO date/time APIs](https://zod.dev/api#iso-datetimes).

## Timezone and Deterministic Time

- **Decision**: Capture one reference instant for each request and pass it with the
  effective timezone in the interpretation context. Use `@js-temporal/polyfill`
  `Temporal.ZonedDateTime` for local date/time resolution with `disambiguation:
  reject`; validate configured/explicit IANA zones and reject nonexistent and
  repeated local times instead of silently shifting/selecting one.
- **Rationale**: `Intl.DateTimeFormat` can validate a timezone identifier and format
  instants, but resolving a local wall time to an instant across DST transitions
  needs an explicit policy. A focused Temporal polyfill is safer and clearer than
  custom offset arithmetic. Fixed clock and timezone inputs make relative-time
  behavior reproducible.
- **Alternatives considered**: Restrict all inputs to UTC/offsets (conflicts with
  natural-language local reminders) or implement custom DST offset resolution
  (unnecessary error-prone logic).
- **Risk**: Confirm polyfill and Node runtime compatibility when implementation
  begins; update the dependency manifest only if proceeding with this justified
  dependency.
- **Sources**: [Node.js Intl support](https://nodejs.org/api/intl.html);
  [Temporal ZonedDateTime](https://tc39.es/proposal-temporal/docs/zoneddatetime.html);
  [Temporal polyfill](https://github.com/js-temporal/temporal-polyfill).

## Environment Configuration and Secrets

- **Decision**: Load dotenv at the ESM entrypoint for local development and validate
  required environment variables before listening. `GEMINI_API_KEY` and
  `DEFAULT_TIME_ZONE` are server-side settings; commit only non-secret placeholders
  in `.env.example`, and keep `.env` ignored.
- **Rationale**: A startup configuration failure is safer than accepting requests
  with an implicit timezone or missing provider credentials. Production environments
  may inject variables without dotenv.
- **Alternatives considered**: Hard-coded credentials or implicit timezone defaults;
  both violate the security and deterministic-validation requirements.
- **Risk**: The existing `.env.example` appears to contain a credential. Do not
  reproduce it; rotate/revoke it and replace the example values with placeholders
  before committing or deploying.
- **Sources**: [dotenv README](https://github.com/motdotla/dotenv#readme);
  [GitHub secret scanning guidance](https://docs.github.com/en/code-security/concepts/secret-security/secret-scanning#avoiding-committing-secrets-to-your-repository);
  [Gemini API key guidance](https://ai.google.dev/gemini-api/docs/api-key).

## Tests and Evaluation

- **Decision**: Continue using `node --test`. Test HTTP behavior through an
  ephemeral local server with cleanup hooks; inject a fake interpreter for success,
  rejection, and malformed-output paths. Inject a reference clock rather than
  mutating global time. Use fixed case timezones and the same 24 cases for initial
  and final evaluation.
- **Rationale**: Node's runner supports async tests and teardown hooks without
  another test dependency. Controlled failures make tests deterministic and avoid
  live API quota/network reliance.
- **Alternatives considered**: Live Gemini calls in routine tests or globally
  mocked wall clocks. Both introduce avoidable nondeterminism and cost.
- **Sources**: [Node test runner](https://nodejs.org/api/test.html#test-runner);
  [Project package.json](../../package.json).

## Selected Decisions Summary

| Concern | Decision |
|---|---|
| Runtime | Node.js 22 or later; validate selected SDK/runtime compatibility |
| API | Express 5 JSON API, bounded body parsing, normalized JSON errors |
| Gemini | Server-side structured JSON generation; never trust output without Zod |
| Schema | Strict Zod parse followed by independent domain checks |
| Time | One reference instant; IANA timezone; Temporal resolution rejects DST ambiguity |
| Default timezone | Required `DEFAULT_TIME_ZONE`; example `Asia/Kolkata`; no implicit fallback |
| Tests | `node --test`, fake provider, fixed clock/timezone; all 24 evaluation cases |
| Persistence/notifications | None |
