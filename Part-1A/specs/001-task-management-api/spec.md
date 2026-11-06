# Feature Specification: DayFlow Task Management API

**Feature Branch**: `Not created (no branch hook configured)`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "Create the baseline feature specification for DayFlow – Smart Todo & Task Manager."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Organize and Find Tasks (Priority: P1)

An individual creates tasks for daily work, reviews the task list or a specific task, and finds
tasks by tag or priority.

**Why this priority**: Creating and finding tasks provides the basic value of a task manager.

**Independent Test**: Create tasks with and without optional values, then retrieve, filter, and sort
them; all results and defaults are observable in the API responses.

**Acceptance Scenarios**:

1. **AC-01 — Default creation**: Given an empty task list, when a user submits
   `{"title":"Prepare notes"}`, then the API returns `201` with a task having a unique ID, empty
   description and tags, `Pending` status, Medium priority, and ISO 8601 UTC creation and update
   timestamps ending in `Z`. The task is present in the subsequent list response.
2. **AC-02 — Custom creation**: Given an empty task list, when a user submits
   `{"title":"Plan trip","description":"Compare dates","priority":"High","tags":["travel","family"]}`,
   then the API returns `201` and the task response contains the submitted values, `Pending` status,
   and both timestamps ending in `Z`.
3. **AC-03 — Required title validation**: Given an empty task list, when a user submits a task with
   a missing title, an empty title, or a whitespace-only title, then the API returns `400` with the
   standard error JSON. The task list remains empty.
4. **AC-04 — List and detail retrieval**: Given two existing tasks, when the user sends `GET
   /tasks` and then `GET /tasks/{id}` for one task, then the list contains both tasks and the detail
   response contains exactly the requested task. A request using an unknown ID returns `404`.
5. **AC-07 — Deterministic priority sorting**: Given at least one task at each priority, plus
   High-priority tasks with different creation timestamps and two High-priority tasks sharing a
   timestamp but having different IDs, when the user sends `GET /tasks?sort=priority`, then the
   response orders tasks by priority High, Medium, Low; within each priority, by creation timestamp
   ascending (oldest first); and for equal timestamps, by task ID ascending.
6. **AC-08 — Case-insensitive tag filtering**: Given tasks tagged `Work`, `work`, and `Home`, when
   the user sends `GET /tasks?tag=WORK`, then only the first two tasks are returned. A task without
   that tag is not returned.

---

### User Story 2 - Maintain Task Details and Progress (Priority: P1)

A user corrects task details, removes tasks that are no longer needed, and advances work through
the permitted statuses.

**Why this priority**: Task details and progress change as daily work is completed; users need to
maintain accurate records.

**Independent Test**: Update and delete existing tasks and attempt valid and invalid status
transitions; inspect both responses and persisted task values.

**Acceptance Scenarios**:

1. **AC-05 — Valid and invalid updates**: Given an existing task, when the user sends `PATCH
   /tasks/{id}` with a valid partial update to its title, description, priority, or tags, then the
   API returns `200` with `{"data":<task>}`, the changed values, and a changed update timestamp.
   The returned update timestamp ends in `Z`.
   When the user submits an empty or whitespace-only title, invalid priority, or invalid field
   value, then the API returns `400` and the entire existing task, including its update timestamp,
   remains unchanged. Updating an unknown ID returns `404` and does not change any task.
2. **AC-06 — Delete existing and unknown tasks**: Given an existing task, when the user sends
   `DELETE /tasks/{id}`, then the API returns `200` with `{"data":{"id":"...","deleted":true}}`
   and a subsequent list no longer contains it. When the user deletes an unknown ID, then the API
   returns `404` with the standard error JSON.
3. **AC-09 — Status transitions**:
   - Given a task with status `Pending`, when the user sends
     `PATCH /tasks/{id}/status` with `{"status":"InProgress"}`, then the API returns `200` with
     `{"data":<task>}`, status `InProgress`, and a changed update timestamp ending in `Z`.
   - Given a task with status `InProgress`, when the user sends
     `PATCH /tasks/{id}/status` with `{"status":"Completed"}`, then the API returns `200` with
     `{"data":<task>}`, status `Completed`, and a changed update timestamp ending in `Z`.
   - Given a task with status `Completed`, when the user sends
     `PATCH /tasks/{id}/status` with `{"status":"InProgress"}`, then the API returns `200` with
     `{"data":<task>}`, status `InProgress`, and a changed update timestamp ending in `Z`.
   - Given a task in any of the three statuses, when the user requests any of the rejected
     transitions (`Pending` → `Pending`, `Pending` → `Completed`, `InProgress` → `Pending`,
     `InProgress` → `InProgress`, `Completed` → `Pending`, or `Completed` → `Completed`), then
     the API returns `409` and the task, including its update timestamp, remains unchanged.

---

### User Story 3 - Keep Tasks Available and Handle Failures Safely (Priority: P2)

A user can rely on saved tasks after restarting the service and receives useful errors without
losing valid task data when input or stored data is invalid.

**Why this priority**: Persistence and safe failure protect the user's work and make local use
reliable.

**Independent Test**: Create tasks, restart the service, and verify the data remains; then test
malformed stored data and invalid requests for safe, observable failure.

**Acceptance Scenarios**:

1. **AC-10 — Persistence after restart**: Given a created and updated task, when the service is
   stopped and started again with the same configured data file, then list and detail requests
   return the task with its latest values and timestamps ending in `Z`.
2. **AC-11 — Malformed or invalid stored data**: Given a data file containing malformed JSON or
   valid JSON with an invalid task record, when the service starts, then it refuses to serve
   requests, emits a diagnostic that identifies invalid stored task data without exposing secrets,
   and leaves the file byte-for-byte unchanged.
3. **AC-12 — HTTP errors and response shape**: Given malformed JSON in a request, invalid field
   values, an unknown task ID, an invalid status transition, or an unexpected internal failure,
   when the user makes the request, then the API returns respectively `400` with
   `INVALID_JSON`, `400` with `VALIDATION_ERROR`, `404` with `TASK_NOT_FOUND`, `409` with
   `INVALID_STATUS_TRANSITION`, or `500` with `INTERNAL_ERROR`. Every error response is JSON shaped
   as `{"error":{"code":"...","message":"..."}}`, contains a safe, meaningful message, and excludes
   stack traces and internal details.
4. **AC-13 — Local deterministic use**: Given the documented setup and test instructions, when a
   contributor follows them on a local machine without connecting to external services, then the
   service starts and the automated acceptance tests complete successfully. Repeating the same
   tests against the same starting data produces the same task results.
5. **AC-14 — JSON request body size boundary**: Given JSON request bodies whose sizes are measured
   as UTF-8 bytes after serialization, when a valid task-creation body is exactly 1,048,575 bytes
   or exactly 1,048,576 bytes, then each request proceeds through normal validation and returns
   `201`. A body containing 1,048,577 bytes sent to any JSON-body operation (`POST /tasks`,
   `PATCH /tasks/{id}`, or `PATCH /tasks/{id}/status`) returns `413` with the standard JSON error
   envelope and code `PAYLOAD_TOO_LARGE`, without changing stored tasks. An invalid request body at
   or below 1,048,576 bytes proceeds to normal validation and returns its ordinary validation error
   rather than `413`.

### Edge Cases

- A title containing only whitespace is invalid; surrounding whitespace on a non-empty title is
  trimmed before it is stored.
- A partial update changes only fields supplied by the user. An empty update object or an
  unsupported field is rejected and does not change the task or its timestamp.
- Omitted description is stored as an empty string on creation; an empty description in an update
  clears it. A null description is invalid.
- Tags must be non-empty strings after trimming. Duplicate tags are not stored; tag identity and
  filtering are case-insensitive while the first supplied spelling is preserved.
- An unknown sort value or an empty tag filter is rejected with `400`.
- Status is changed only through the dedicated status operation; supplying it in a create or general
  update request is rejected with `400`. The only API values are `Pending`, `InProgress`, and
  `Completed`; `In Progress` may be used only as a human-readable label.
- Invalid task data on disk is never interpreted as an empty task list and never overwritten by an
  attempted request.
- JSON request-body size is measured in UTF-8 bytes, not characters. Bodies of up to and including
  1,048,576 bytes proceed to normal validation; larger bodies return `413` with the standard JSON
  error envelope.
- Generated and persisted task timestamps use ISO 8601 UTC representations ending in `Z`; an
  offset-form timestamp, including one ending in `+00:00`, does not satisfy the timestamp contract.
- A failed validation or rejected status transition leaves all stored task fields and timestamps
  unchanged.
- Tasks with equal priority are ordered by creation timestamp ascending, then task ID ascending
  when timestamps are equal.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-01 — Create a task**: The API MUST create a task when given a non-empty title through
  `POST /tasks`. Description and tags are optional. The API MUST assign each task a unique ID, set
  its initial status to `Pending`, set priority to Medium unless a valid priority is supplied, and
  record creation and update timestamps in ISO 8601 UTC format ending in `Z`. Offset-form
  timestamps do not satisfy this contract. Creation returns `201` with
  `{"data":<task>}`. Maps to AC-01, AC-02, AC-03, AC-12.
- **FR-02 — View tasks**: The API MUST allow users to retrieve all tasks through `GET /tasks` and
  retrieve a task by ID through `GET /tasks/{id}`. List responses use `{"data":[...]}`; detail
  responses use `{"data":<task>}`. An unknown ID MUST return `404` without changing stored data.
  Maps to AC-04, AC-12.
- **FR-03 — Update a task**: The API MUST allow partial updates through `PATCH /tasks/{id}` to
  title, description, priority, and tags. It MUST validate the complete proposed task before saving
  it. A successful update MUST return `200` with `{"data":<task>}` and change the update timestamp,
  which MUST use ISO 8601 UTC representation ending in `Z`; an invalid update MUST leave every
  stored field unchanged. Maps to AC-05, AC-12.
- **FR-04 — Delete a task**: The API MUST allow users to delete an existing task through
  `DELETE /tasks/{id}`. A successful deletion returns `200` with
  `{"data":{"id":"...","deleted":true}}`. Deleting an unknown ID MUST return `404` and MUST NOT
  modify other tasks. Maps to AC-06, AC-12.
- **FR-05 — Task priorities**: The API MUST accept only Low, Medium, or High priority. Users MUST
  be able to request tasks sorted through `GET /tasks?sort=priority` in descending priority order:
  High, Medium, then Low. Tasks with equal priority MUST be sorted by creation timestamp ascending
  (oldest first), with task ID ascending as the final tie-breaker when timestamps are equal. Maps
  to AC-02, AC-05, AC-07, AC-12.
- **FR-06 — Task tags and filtering**: The API MUST allow zero or more tags per task and allow
  users to filter tasks through `GET /tasks?tag={tag}` by one tag. Matching MUST be exact and
  case-insensitive. Maps to AC-01, AC-02, AC-05, AC-08.
- **FR-07 — Task status management**: The API MUST support the exact status values `Pending`,
  `InProgress`, and `Completed`. Users change status through `PATCH /tasks/{id}/status` with one of
  these target values. The API MUST allow `Pending` → `InProgress`, `InProgress` → `Completed`, and
  `Completed` → `InProgress` only. A rejected transition MUST return `409` and MUST NOT modify the
  task or its update timestamp. `In Progress` MAY appear only as a human-readable label, never as
  an API status value. Maps to AC-09, AC-12.
- **FR-08 — Data persistence**: The API MUST persist task data in a JSON file and make valid task
  data available after restart. Invalid or malformed stored data MUST NOT silently replace or erase
  valid task data; malformed JSON MUST cause a clear fail-closed startup error without modifying
  the file. Maps to AC-10, AC-11.
- **FR-09 — Consistent API responses and validation**: Successful responses MUST use predictable
  JSON structures, with task results under `data`. Errors MUST use
  `{"error":{"code":"...","message":"..."}}` with an appropriate HTTP status, and MUST NOT expose
  stack traces or internal details. Validation errors use `VALIDATION_ERROR`, malformed request
  JSON uses `INVALID_JSON`, unknown IDs use `TASK_NOT_FOUND`, rejected status transitions use
  `INVALID_STATUS_TRANSITION`, oversized JSON request bodies use `PAYLOAD_TOO_LARGE` with HTTP
  `413`, and unexpected failures use `INTERNAL_ERROR`. JSON request bodies MUST be measured in
  UTF-8 bytes, not characters; bodies at or below 1,048,576 bytes MUST proceed to normal validation,
  while larger bodies MUST return `413`. Request bodies MUST be validated before any state change.
  Maps to AC-03, AC-05, AC-06, AC-09, AC-12, AC-14.
- **FR-10 — Deterministic local operation**: The service and its acceptance tests MUST operate
  without external services and MUST produce repeatable results for the same starting data and
  requests. Setup and test instructions MUST support local use. Maps to AC-13.

### Key Entities *(include if feature involves data)*

- **Task**: A user's work item, identified by a unique ID and containing a required title, optional
  description, priority, status, zero or more tags, creation timestamp, and update timestamp.
- **Priority**: One of Low, Medium, or High; determines the specified task sort order.
- **Status**: One of the API values `Pending`, `InProgress`, or `Completed`; changes only through
  the permitted transitions. `In Progress` is permitted only as a human-readable label.
- **Tag**: A non-empty label assigned to a task; matching is exact and case-insensitive.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 14 acceptance scenarios pass, including the expected status codes, response
  structures, and state changes.
- **SC-002**: In a test set of 1,000 tasks, all tasks are returned in a list request, and priority
  sorting and tag filtering each return the complete correct result within one second in the local
  test environment.
- **SC-003**: Across all invalid-input and invalid-transition scenarios, 100% of rejected
  operations leave task data unchanged.
- **SC-004**: After a service restart, 100% of tasks successfully saved before shutdown remain
  retrievable with their latest field values.
- **SC-005**: No error response in the acceptance scenarios contains a stack trace or internal
  diagnostic details; malformed stored JSON is reported without changing the original file.
- **SC-006**: An individual can create, retrieve, update, transition, filter, sort, and delete tasks
  using the documented REST interface without an account, frontend, or external service.

## Assumptions

- The application serves one local user; authentication, accounts, databases, frontend UI,
  external integrations, recurring tasks, reminders, and notifications are out of scope.
- Tags may be omitted or empty because tasks are useful without categorization. Each supplied tag is
  trimmed, duplicate tags are removed case-insensitively, and the first spelling is retained.
- A supplied non-empty title is trimmed before storage. Omitted description defaults to an empty
  string, and an empty string clears description during update.
- Task creation and update timestamps use ISO 8601 UTC representations ending in `Z`. Offset-form
  timestamps, including `+00:00`, do not satisfy the contract. A successful update or status
  transition produces an update timestamp distinct from the previous value.
- A task status is changed through a dedicated status-change request, not by creating a task or
  editing its other fields. Status transitions are checked against the current stored status. API
  values are exactly `Pending`, `InProgress`, and `Completed`; `In Progress` is only a
  human-readable label.
- The list can be filtered with the `tag` query parameter and sorted by priority with
  `sort=priority`; ties are resolved by creation timestamp ascending, then task ID ascending.
- Invalid request JSON and invalid field values return `400`; invalid status transitions return
  `409`; unknown tasks return `404`; oversized JSON request bodies return `413` with
  `PAYLOAD_TOO_LARGE`; unexpected server failures return `500`. The request-body limit is 1,048,576
  UTF-8 bytes (not characters), and requests at or below the limit proceed to normal validation. A
  malformed data file causes startup to fail closed, because serving an empty list could conceal or
  overwrite user data.
- The one-second list/filter/sort target is measured locally against a fixture of 1,000 tasks and
  is a usability baseline, not a guarantee for every machine or deployment.
