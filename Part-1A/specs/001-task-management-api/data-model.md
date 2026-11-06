# Data Model: DayFlow Task Management API

## Task

Represents one personal work item.

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `id` | string | Yes | Unique, non-empty identifier assigned at creation; immutable. Generated with a cryptographic UUID in production. |
| `title` | string | Yes | Trim surrounding whitespace; reject missing, non-string, empty, or whitespace-only values. |
| `description` | string | Yes in stored/returned task | Defaults to `""`; an update may set it to `""` to clear it. `null` and non-string values are invalid. |
| `priority` | string enum | Yes | Exactly `Low`, `Medium`, or `High`; defaults to `Medium`. |
| `status` | string enum | Yes | Exactly `Pending`, `InProgress`, or `Completed`; defaults to `Pending`. Client cannot set it in create/general update. |
| `tags` | array of strings | Yes | Defaults to `[]`; each tag must be a non-empty trimmed string. Remove duplicates case-insensitively while retaining the first spelling. |
| `createdAt` | string | Yes | Immutable ISO 8601 UTC timestamp ending in `Z`; offset-form representations are invalid. |
| `updatedAt` | string | Yes | ISO 8601 UTC timestamp ending in `Z`; offset-form representations are invalid. Updated on each successful task mutation and unchanged on rejection. |

### Task validation

- Creation requires `title`; `description` and `tags` may be omitted. Priority may be omitted, in
  which case it is `Medium`. Status, IDs, and timestamps are server-managed and cannot be supplied
  as client-controlled creation fields.
- General update accepts a non-empty partial object containing only `title`, `description`,
  `priority`, and `tags`. Unknown fields, an empty object, or invalid values reject the whole
  update. Validate the candidate task before writing.
- Tag comparison and filtering use exact, case-insensitive matching. Preserve the first spelling
  after trimming.
- Persisted records are validated by the same domain rules, including exact enum values, unique IDs,
  ISO 8601 UTC timestamps ending in `Z` (reject offset-form timestamps, including `+00:00`), and
  collection shape.

## Status transitions

| Current | Requested | Result |
|---------|-----------|--------|
| `Pending` | `InProgress` | Accept |
| `InProgress` | `Completed` | Accept |
| `Completed` | `InProgress` | Accept |
| Any other current/target pair | Any | Reject with `409`; task and `updatedAt` remain unchanged |

Status changes use the dedicated status operation. `In Progress` is only a human-readable label,
never a stored or transmitted API status value.

## Task collection and ordering

The JSON document has a root object containing a `tasks` array of task records. The API retrieves
that collection as a list, with an optional exact, case-insensitive tag filter. When
`sort=priority` is requested, order by:

1. Priority descending: `High`, `Medium`, `Low`.
2. `createdAt` ascending (oldest first).
3. `id` ascending using a deterministic code-point comparison.

The task ID tie-breaker ensures deterministic output when creation timestamps are equal.

## Persistence integrity

- A missing configured file may be initialized as an empty collection.
- Malformed JSON, an invalid root structure, duplicate IDs, or an invalid task record causes startup
  to fail closed. Do not interpret invalid content as an empty collection or overwrite it.
- Validate the candidate collection before write. Serialize in-process mutations and replace the
  file from a complete same-directory temporary file; a failed write must not produce a success
  response or discard the last valid file.
- Requests cannot select or alter the persistence path. The path is trusted local configuration.
