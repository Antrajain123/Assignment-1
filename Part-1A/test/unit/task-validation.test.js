import assert from "node:assert/strict";
import test from "node:test";
import {
  TaskValidationError,
  validateCreateTask,
  validatePersistedTask,
  validateStatusUpdate,
  validateTaskCollection,
  validateUpdateTask,
} from "../../src/validation/task-validation.js";

const validTask = {
  id: "task-1",
  title: "Prepare notes",
  description: "",
  priority: "Medium",
  status: "Pending",
  tags: [],
  createdAt: "2026-11-05T10:00:00.000Z",
  updatedAt: "2026-11-05T10:00:00.000Z",
};

test("create validation trims title and applies optional-field defaults", () => {
  assert.deepEqual(validateCreateTask({ title: "  Prepare notes  " }), {
    title: "Prepare notes",
    description: "",
    priority: "Medium",
    tags: [],
  });
});

test("create validation preserves optional values and first tag spelling", () => {
  assert.deepEqual(
    validateCreateTask({
      title: "Plan trip",
      description: "Compare dates",
      priority: "High",
      tags: [" Work ", "work", "Home"],
    }),
    {
      title: "Plan trip",
      description: "Compare dates",
      priority: "High",
      tags: ["Work", "Home"],
    },
  );
});

test("create validation rejects missing, non-string, empty, and whitespace titles", () => {
  for (const body of [{}, { title: null }, { title: 5 }, { title: "" }, { title: " \t " }]) {
    assert.throws(() => validateCreateTask(body), TaskValidationError);
  }
});

test("create validation rejects unsupported fields and invalid values", () => {
  for (const body of [
    { title: "Task", id: "caller-id" },
    { title: "Task", status: "Pending" },
    { title: "Task", priority: "Urgent" },
    { title: "Task", description: null },
    { title: "Task", description: 2 },
    { title: "Task", tags: "work" },
    { title: "Task", tags: [" "] },
  ]) {
    assert.throws(() => validateCreateTask(body), TaskValidationError);
  }
});

test("update validation accepts valid partial fields and empty description", () => {
  assert.deepEqual(
    validateUpdateTask({ description: "", tags: ["Work", "work"] }),
    { description: "", tags: ["Work"] },
  );
});

test("update validation rejects empty objects, unsupported fields, and invalid values", () => {
  for (const body of [
    {},
    { status: "Completed" },
    { createdAt: validTask.createdAt },
    { title: " \n" },
    { priority: "Urgent" },
    { description: null },
    { tags: [""] },
  ]) {
    assert.throws(() => validateUpdateTask(body), TaskValidationError);
  }
});

test("status update validation accepts only exact API values", () => {
  for (const status of ["Pending", "InProgress", "Completed"]) {
    assert.deepEqual(validateStatusUpdate({ status }), { status });
  }

  for (const body of [
    {},
    { status: "In Progress" },
    { status: "pending" },
    { status: "Unknown" },
    { status: "Completed", extra: true },
  ]) {
    assert.throws(() => validateStatusUpdate(body), TaskValidationError);
  }
});

test("persisted task validation accepts canonical UTC task data", () => {
  assert.deepEqual(validatePersistedTask(validTask), validTask);
});

test("persisted task validation rejects malformed fields and offset timestamps", () => {
  const invalidTasks = [
    { ...validTask, title: " " },
    { ...validTask, priority: "Urgent" },
    { ...validTask, status: "In Progress" },
    { ...validTask, tags: ["Work", "work"] },
    { ...validTask, createdAt: "2026-11-05T10:00:00+05:30" },
    { ...validTask, updatedAt: "2026-11-05T10:00:00+00:00" },
    { ...validTask, createdAt: "2026-02-30T10:00:00.000Z" },
    { ...validTask, extra: true },
  ];

  for (const task of invalidTasks) {
    assert.throws(() => validatePersistedTask(task), TaskValidationError);
  }
});

test("task collection validation requires records with unique IDs", () => {
  assert.deepEqual(validateTaskCollection([validTask]), [validTask]);
  assert.throws(
    () => validateTaskCollection([validTask, { ...validTask, title: "Other" }]),
    TaskValidationError,
  );
  assert.throws(() => validateTaskCollection({ tasks: [validTask] }), TaskValidationError);
});
