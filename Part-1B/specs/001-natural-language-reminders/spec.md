# Feature Specification: Natural Language Reminder API

**Feature Branch**: `001-natural-language-reminders`

**Created**: 2026-11-05

**Status**: Implemented — Accepted

**Input**: User description: "Build a web API that accepts a natural-language reminder request, uses Google's Gemini API to interpret it, validates the structured result, and returns a reliable reminder object. Reject or request clarification for ambiguous requests, validate date/time values and ensure reminders are not scheduled in the past, handle invalid input and service/model failures consistently, and provide evaluation, evidence, and API documentation. Do not send notifications or schedule background jobs."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a reminder from a clear request (Priority: P1)

A caller submits a clear natural-language request and receives a structured reminder
with its title, date, time, timezone, and any optional description.

**Why this priority**: Interpreting a valid request is the primary purpose of the
service.

**Independent Test**: Submit a clear request with a fixed reference time and
configured timezone; verify each returned field against the expected reminder.

**Acceptance Scenarios**:

1. **Given** a valid request, an available interpreter, and a valid configured
   default timezone, **When** the caller requests "Remind me to submit my assignment
   tomorrow at 10 AM.", **Then** the response contains one schema-conforming reminder
   for tomorrow at 10:00 in the configured timezone.
2. **Given** a request that explicitly names a valid timezone, **When** it is
   interpreted, **Then** the reminder uses that timezone rather than the configured
   default.
3. **Given** a valid request with a stated description, **When** it is interpreted,
   **Then** the description is included without changing the meaning of the title or
   schedule.

---

### User Story 2 - Clarify incomplete or ambiguous requests (Priority: P1)

A caller is told what information is missing or ambiguous instead of receiving a
reminder whose details were guessed.

**Why this priority**: A plausible but incorrect date, time, or title can make the
result unreliable; clarification is safer than invention.

**Independent Test**: Submit requests with missing required details or multiple
plausible interpretations and verify that each produces a clarification response and
no reminder object.

**Acceptance Scenarios**:

1. **Given** a request with no date or time, **When** it is interpreted, **Then** the
   response asks for the missing schedule details and contains no reminder.
2. **Given** a request with a date such as "03/04" that has multiple plausible
   interpretations, **When** it is interpreted, **Then** the response asks the caller
   to clarify the date and contains no reminder.
3. **Given** no explicit timezone and a valid configured default timezone, **When**
   the request is interpreted, **Then** the configured timezone is used; **And given**
   no explicit timezone and no valid configured default, **Then** the service returns
   a configuration error and does not invent a timezone.

---

### User Story 3 - Receive reliable errors and review quality (Priority: P2)

A caller receives a consistent error response when the request or interpretation
cannot produce a valid reminder, while a project reviewer can inspect evaluation
results and limitations.

**Why this priority**: Clear failure behavior and repeatable evidence make the API
safe to use and the academic result assessable.

**Independent Test**: Exercise invalid requests and simulated provider/configuration
failures, then inspect the documented evaluation cases and preserved result files.

**Acceptance Scenarios**:

1. **Given** malformed or missing request data, **When** the caller submits it,
   **Then** the API returns a consistent client-error JSON response and no reminder.
2. **Given** malformed structured output or an unavailable Gemini service, **When**
   interpretation fails, **Then** the API returns a consistent service-error JSON
   response and no reminder.
3. **Given** a completed implementation and evaluation, **When** a human reviewer
   reviews the implementation, results, and limitations, **Then** the reviewer records
   a final **ACCEPT** or **REJECT** decision.

### Edge Cases

- The request body is empty, malformed JSON, absent, or contains an empty/whitespace
  request string.
- The request omits a required title, date, or time, or uses language with more than
  one plausible interpretation.
- A date or time is syntactically invalid, impossible (for example, February 30), or
  outside the supported timezone rules.
- The requested reminder is earlier than the current instant, including a reminder
  at exactly the current instant.
- A relative date crosses midnight, a month boundary, a year boundary, or a daylight
  saving time transition in the effective timezone.
- A local time is ambiguous because clocks move backward during a daylight saving
  transition.
- An explicit timezone is invalid or absent while no valid default is configured.
- The model returns missing fields, extra or wrong-typed fields, invalid JSON, or a
  schema-valid but semantically unsupported interpretation.
- The Gemini API key is missing, the provider is unavailable, or the provider returns
  an error or times out.
- A request includes multiple reminders; v1 accepts one reminder per request and
  must not silently discard or merge the others.
- A long or irrelevant request cannot be safely interpreted as a single reminder.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The service MUST accept one natural-language reminder request through
  `POST /reminders` with a JSON body containing a non-empty `request` string. A valid
  successful request MUST return HTTP 200.
- **FR-002**: The service MUST interpret the request into a reminder title, calendar
  date, local time, effective timezone, and optional description.
- **FR-003**: The success response MUST be JSON with a `reminder` object containing
  `title` (non-empty string), `date` (`YYYY-MM-DD`), `time` (`HH:mm`, 24-hour local
  time), `timezone` (valid IANA timezone identifier), and optional `description`
  (string). No extra reminder fields are allowed in the v1 contract.
- **FR-004**: The interpretation MUST use the Gemini service and request structured
  reminder data. The application MUST validate the complete model result against the
  defined schema using Zod before returning it.
- **FR-005**: The application MUST independently validate required values, calendar
  date and time validity, timezone validity, and reminder invariants; model-provided
  claims of validity MUST NOT bypass these checks.
- **FR-006**: The effective timezone MUST be an explicit valid timezone in the
  request or the valid configured default timezone. An explicit valid timezone MUST
  take precedence. If neither is available, the service MUST return an error rather
  than assume a timezone.
- **FR-007**: Relative dates and times MUST be resolved against a single captured
  reference instant in the effective timezone. The evaluation harness MUST allow a
  fixed reference instant and timezone so results are repeatable.
- **FR-008**: The service MUST reject or request clarification when required details
  are missing, wording has multiple plausible interpretations, or a request cannot
  be reduced to one reminder without guessing. Clarification responses MUST identify
  the missing or ambiguous information and MUST NOT include a reminder object.
- **FR-009**: The service MUST reject reminders whose resolved instant is less than
  or equal to the reference instant. The comparison MUST account for the effective
  timezone and daylight saving time.
- **FR-010**: The service MUST return JSON error responses using a consistent shape:
  an `error` object with a stable `code` and human-readable `message`; clarification
  errors MAY also include a `questions` array. Failed responses MUST NOT contain a
  success reminder.
- **FR-011**: The service MUST distinguish failure classes with stable status/code
  pairs: malformed JSON or missing/empty request (`400`, `invalid_request`), invalid
  or past reminder details (`422`, `invalid_reminder`), requests needing clarification
  (`422`, `needs_clarification`), missing configuration (`503`,
  `configuration_error`), and malformed interpreter output or provider failure
  (`502`, `interpretation_failed`).
- **FR-012**: The Gemini API key MUST be loaded from an environment variable and MUST
  not be included in source, responses, or evaluation evidence. Missing key
  configuration MUST fail safely and visibly.
- **FR-013**: The v1 service MUST interpret and validate reminders only. It MUST NOT
  send notifications, persist reminders, or schedule background jobs.
- **FR-014**: Project documentation MUST define the API request and response
  contracts, error behavior, environment configuration, test instructions, and
  evaluation instructions.
- **FR-015**: The evaluation suite MUST contain at least 15 meaningful scenarios and
  cover normal requests, relative dates, missing details, ambiguous dates/times,
  invalid requests, boundary cases, and model or provider failures.
- **FR-016**: Evaluation MUST separately report schema correctness, deterministic
  properties/invariants, and semantic correctness of extracted reminder details.
  Semantic scoring MUST compare title, date, time, timezone, and description where
  applicable against expected values.
- **FR-017**: Evaluation MUST preserve the initial results before repairs and the
  final results after repairs in reviewable artifacts, and document the evaluation
  cases, results, known limitations, and final human **ACCEPT** or **REJECT** decision.
- **FR-018**: The project MUST use Node.js, Express, JavaScript ES modules, Gemini,
  and Zod, and MUST keep the design small with no unnecessary abstractions or
  dependencies.

### Evaluation Scenarios

Evaluation uses a fixed reference instant of `2026-03-10T12:00:00Z` and a configured
default timezone of `America/New_York`, unless a scenario explicitly states
otherwise. Relative phrases are resolved at that instant in the effective timezone.
Provider-failure cases use a controlled failure rather than relying on a live outage.

| ID | Category | Request / condition | Expected outcome |
|---|---|---|---|
| E01 | Normal | "Remind me to submit my assignment tomorrow at 10 AM." | Title reflects submission; date `2026-03-11`, time `10:00`, timezone `America/New_York`. |
| E02 | Normal | "Call the dentist on 2026-03-12 at 2:30 PM." | Date `2026-03-12`, time `14:30`, default timezone. |
| E03 | Normal | "Remind me to take my medication tomorrow at 8 AM; the dose is in the kitchen." | Correct title and schedule; description preserves the stated note. |
| E04 | Relative time | "Remind me to stretch in two hours." | Date `2026-03-10`, time `10:00`, default timezone. |
| E05 | Relative date | "Remind me to email Sam next Friday at 3 PM." | Date `2026-03-13`, time `15:00`, default timezone. |
| E06 | Explicit timezone | "Remind me to call at 9 AM tomorrow in Europe/London." | Date `2026-03-11`, time `09:00`, timezone `Europe/London`. |
| E07 | Missing date | "Remind me to submit my assignment at 10 AM." | Clarification requests a date; no reminder. |
| E08 | Missing time | "Remind me to submit my assignment tomorrow." | Clarification requests a time; no reminder. |
| E09 | Missing title | "Remind me tomorrow at 10 AM." | Clarification requests what to remember; no reminder. |
| E10 | Ambiguous date | "Remind me to pay rent on 03/04 at 9 AM." | Clarification requests an unambiguous date; no reminder. |
| E11 | Ambiguous time | "Remind me to call Alex tomorrow at 8." | Clarification requests AM/PM or a 24-hour time; no reminder. |
| E12 | Invalid request | Empty or whitespace-only `request`. | Client error with stable code; no reminder. |
| E13 | Invalid date | "Remind me to file the report on February 30, 2026 at 9 AM." | Invalid-date error; no reminder. |
| E14 | Past boundary | "Remind me to walk today at 7 AM." | Past-reminder error; no reminder. |
| E15 | Exact-now boundary | "Remind me to check in today at 8 AM." | Past-or-current-reminder error because it equals the reference instant in New York; no reminder. |
| E16 | Calendar boundary | "Remind me to celebrate at 9 AM on December 31, 2026." | Correct year-end date and local time; valid reminder. |
| E17 | Daylight saving boundary | "Remind me to meet at 2:30 AM on March 8, 2026 in America/New_York." | Nonexistent local time is rejected with `invalid_reminder` or clarified; no invented shifted time. |
| E18 | Multiple reminders | "Remind me to call Sam tomorrow at 9 AM and pay rent Friday at 5 PM." | Clarification or unsupported-multiple-reminders error; no merged or silently truncated reminder. |
| E19 | Malformed model output | The interpreter returns invalid JSON or a missing/wrong-typed field. | Service error with stable code; no reminder. |
| E20 | Invalid model timezone | The interpreter returns an unknown timezone identifier. | Validation/service error; no reminder. |
| E21 | Provider failure | Gemini returns an error or times out. | Service error with stable code; no reminder and no provider details or secrets leaked. |
| E22 | Missing configuration | Gemini API key is absent. | Configuration/service error with stable code; no reminder. |
| E23 | Missing timezone configuration | No request timezone and no valid configured default timezone. | Configuration error; no implicit timezone and no reminder. |
| E24 | Invalid model time | The interpreter returns `25:75` as the reminder time. | Validation/service error; no reminder. |

### Key Entities

- **Reminder request**: A caller's natural-language text and, optionally, an explicit
  timezone.
- **Reminder**: The validated title, date, local time, effective timezone, and
  optional description returned for one requested reminder.
- **Clarification**: A response that identifies missing or ambiguous information
  needed before a reminder can be formed.
- **Evaluation case**: A versioned input and expected outcome used to assess schema,
  deterministic, and semantic quality.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All successful responses in the evaluation suite conform to the
  documented reminder schema, and all unsuccessful responses contain no reminder.
- **SC-002**: 100% of deterministic validation checks in the evaluation suite reject
  invalid dates, invalid timezones, past/current reminders, and schema-invalid model
  results.
- **SC-003**: At least 90% of unambiguous, supported evaluation cases match all
  expected semantic fields (title, date, time, timezone, and applicable description).
- **SC-004**: 100% of ambiguous or incomplete evaluation cases request clarification
  or return a defined safe error without inventing required reminder details.
- **SC-005**: The evaluation suite contains at least 15 documented scenarios across
  every required category; this specification defines 24 scenarios.
- **SC-006**: Initial and final evaluation evidence are both preserved, reviewable,
  and report results for schema, deterministic/invariant, and semantic checks.
- **SC-007**: The API documentation passes all five reproducible checks in
  `checklists/documentation.md` for request format, successful responses, error
  responses, setup, and test/evaluation instructions. Record the checklist results
  and verification commands or evidence in
  `evaluation/documentation-checklist-results.md`; no external reviewers are
  required.

## Assumptions

- The API handles one reminder per request; requests containing multiple reminders
  are not expanded into multiple results in v1.
- The default timezone is explicitly configured for the service and MUST be a valid
  IANA timezone identifier. The actual configured value is deployment-specific;
  evaluation uses `America/New_York`.
- An explicit timezone in the caller's text takes precedence over the configured
  default. When neither exists, the service does not guess.
- The current/reference instant is captured once per request. Evaluation can fix it
  to make relative-time results deterministic.
- The caller can submit a corrected request after receiving clarification; the API
  does not maintain conversational state.
- The service does not persist reminders, deliver notifications, or create
  background jobs.
- Gemini availability and output are external dependencies; evaluation of error
  paths uses controlled provider responses.
- Evaluation evidence is stored as reviewable project artifacts at
  `evaluation/initial-results.json` and `evaluation/final-results.json`; the initial
  artifact is captured before repairs, and the final artifact after repairs.
