const PRIORITIES = new Set(["Low", "Medium", "High"]);
const STATUSES = new Set(["Pending", "InProgress", "Completed"]);
const CREATE_FIELDS = new Set(["title", "description", "priority", "tags"]);
const UPDATE_FIELDS = CREATE_FIELDS;
const TASK_FIELDS = new Set([
  "id",
  "title",
  "description",
  "priority",
  "status",
  "tags",
  "createdAt",
  "updatedAt",
]);
const UTC_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export class TaskValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "TaskValidationError";
    this.code = "VALIDATION_ERROR";
  }
}

function requireObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TaskValidationError(`${label} must be a JSON object`);
  }
}

function rejectUnknownFields(value, allowedFields) {
  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) {
      throw new TaskValidationError(`Unsupported field: ${field}`);
    }
  }
}

function validateTitle(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TaskValidationError("title must be a non-empty string");
  }

  return value.trim();
}

function validateDescription(value) {
  if (typeof value !== "string") {
    throw new TaskValidationError("description must be a string");
  }

  return value;
}

function validatePriority(value) {
  if (!PRIORITIES.has(value)) {
    throw new TaskValidationError("priority must be Low, Medium, or High");
  }

  return value;
}

function validateTags(value) {
  if (!Array.isArray(value)) {
    throw new TaskValidationError("tags must be an array of strings");
  }

  const seen = new Set();
  const tags = [];
  for (const tag of value) {
    if (typeof tag !== "string" || tag.trim().length === 0) {
      throw new TaskValidationError("each tag must be a non-empty string");
    }

    const trimmedTag = tag.trim();
    const normalizedTag = trimmedTag.toLocaleLowerCase("en-US");
    if (!seen.has(normalizedTag)) {
      seen.add(normalizedTag);
      tags.push(trimmedTag);
    }
  }

  return tags;
}

function validateTimestamp(value, field) {
  if (
    typeof value !== "string" ||
    !UTC_TIMESTAMP_PATTERN.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    throw new TaskValidationError(`${field} must be an ISO 8601 UTC timestamp ending in Z`);
  }

  const date = new Date(value);
  if (date.toISOString() !== value) {
    throw new TaskValidationError(`${field} must be a valid ISO 8601 UTC timestamp`);
  }

  return value;
}

export function validateCreateTask(value) {
  requireObject(value, "Task");
  rejectUnknownFields(value, CREATE_FIELDS);

  const result = {
    title: validateTitle(value.title),
    description:
      value.description === undefined ? "" : validateDescription(value.description),
    priority: value.priority === undefined ? "Medium" : validatePriority(value.priority),
    tags: value.tags === undefined ? [] : validateTags(value.tags),
  };

  return result;
}

export function validateUpdateTask(value) {
  requireObject(value, "Task update");
  rejectUnknownFields(value, UPDATE_FIELDS);

  if (Object.keys(value).length === 0) {
    throw new TaskValidationError("Task update must include at least one field");
  }

  const result = {};
  if (Object.hasOwn(value, "title")) {
    result.title = validateTitle(value.title);
  }
  if (Object.hasOwn(value, "description")) {
    result.description = validateDescription(value.description);
  }
  if (Object.hasOwn(value, "priority")) {
    result.priority = validatePriority(value.priority);
  }
  if (Object.hasOwn(value, "tags")) {
    result.tags = validateTags(value.tags);
  }

  return result;
}

export function validateStatusUpdate(value) {
  requireObject(value, "Status update");
  rejectUnknownFields(value, new Set(["status"]));

  if (Object.keys(value).length !== 1 || !STATUSES.has(value.status)) {
    throw new TaskValidationError("status must be Pending, InProgress, or Completed");
  }

  return { status: value.status };
}

export function validatePersistedTask(value) {
  requireObject(value, "Persisted task");
  rejectUnknownFields(value, TASK_FIELDS);

  if (typeof value.id !== "string" || value.id.trim().length === 0) {
    throw new TaskValidationError("id must be a non-empty string");
  }

  const title = validateTitle(value.title);
  const description = validateDescription(value.description);
  const priority = validatePriority(value.priority);
  if (!STATUSES.has(value.status)) {
    throw new TaskValidationError("status must be Pending, InProgress, or Completed");
  }
  const tags = validateTags(value.tags);
  if (tags.length !== value.tags.length || tags.some((tag, index) => tag !== value.tags[index])) {
    throw new TaskValidationError("persisted tags must be trimmed and unique");
  }
  validateTimestamp(value.createdAt, "createdAt");
  validateTimestamp(value.updatedAt, "updatedAt");

  if (
    title !== value.title ||
    description !== value.description ||
    priority !== value.priority
  ) {
    throw new TaskValidationError("persisted task fields must use canonical values");
  }

  return value;
}

export function validateTaskCollection(value) {
  if (!Array.isArray(value)) {
    throw new TaskValidationError("Task collection must be an array");
  }

  const ids = new Set();
  for (const task of value) {
    validatePersistedTask(task);
    if (ids.has(task.id)) {
      throw new TaskValidationError(`Duplicate task ID: ${task.id}`);
    }
    ids.add(task.id);
  }

  return value;
}
