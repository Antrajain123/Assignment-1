import assert from "node:assert/strict";
import test from "node:test";
import { createClockSource } from "../helpers/deterministic-sources.js";
import { createTaskService } from "../../src/services/task-service.js";

function createMemoryStore(initialTasks = []) {
  let tasks = initialTasks.map((task) => ({ ...task, tags: [...task.tags] }));
  const clone = (items) => items.map((task) => ({ ...task, tags: [...task.tags] }));

  return {
    async readTasks() {
      return clone(tasks);
    },
    async mutateTasks(mutator) {
      const candidate = await mutator(clone(tasks));
      tasks = clone(candidate);
      return clone(tasks);
    },
  };
}

const initialTask = {
  id: "task-1",
  title: "Initial title",
  description: "Initial description",
  priority: "Medium",
  status: "Pending",
  tags: ["Work"],
  createdAt: "2026-11-05T10:00:00.000Z",
  updatedAt: "2026-11-05T10:00:00.000Z",
};

function createService() {
  const store = createMemoryStore([initialTask]);
  const service = createTaskService({
    store,
    now: createClockSource("2026-11-05T10:00:01.000Z", 1000),
  });
  return { service, store };
}

test("update changes only permitted fields and advances updatedAt in UTC", async () => {
  const { service, store } = createService();
  const updated = await service.updateTask("task-1", {
    title: " Updated title ",
    description: "",
    priority: "High",
    tags: ["Home", "home", "Urgent"],
  });

  assert.deepEqual(updated, {
    ...initialTask,
    title: "Updated title",
    description: "",
    priority: "High",
    tags: ["Home", "Urgent"],
    updatedAt: "2026-11-05T10:00:01.000Z",
  });
  assert.match(updated.updatedAt, /Z$/);
  assert.deepEqual(await store.readTasks(), [updated]);
});

test("invalid or unsupported updates leave the task and timestamp unchanged", async () => {
  const { service, store } = createService();
  const before = await service.getTask("task-1");

  for (const invalid of [
    {},
    { title: " \t " },
    { priority: "Urgent" },
    { tags: [""] },
    { status: "Completed" },
    { id: "replacement-id" },
  ]) {
    await assert.rejects(service.updateTask("task-1", invalid), { code: "VALIDATION_ERROR" });
    assert.deepEqual(await service.getTask("task-1"), before);
  }
  assert.deepEqual(await store.readTasks(), [before]);
  await assert.rejects(service.updateTask("missing", { title: "Changed" }), {
    status: 404,
    code: "TASK_NOT_FOUND",
  });
});

test("delete removes an existing task and reports its ID", async () => {
  const { service, store } = createService();

  assert.deepEqual(await service.deleteTask("task-1"), { id: "task-1", deleted: true });
  assert.deepEqual(await store.readTasks(), []);
  await assert.rejects(service.deleteTask("task-1"), {
    status: 404,
    code: "TASK_NOT_FOUND",
  });
});

test("status service allows exactly the three specified transitions", async () => {
  const { service } = createService();
  let updated = await service.updateTaskStatus("task-1", { status: "InProgress" });
  assert.equal(updated.status, "InProgress");
  assert.equal(updated.updatedAt, "2026-11-05T10:00:01.000Z");
  assert.match(updated.updatedAt, /Z$/);

  updated = await service.updateTaskStatus("task-1", { status: "Completed" });
  assert.equal(updated.status, "Completed");
  assert.equal(updated.updatedAt, "2026-11-05T10:00:02.000Z");

  updated = await service.updateTaskStatus("task-1", { status: "InProgress" });
  assert.equal(updated.status, "InProgress");
  assert.equal(updated.updatedAt, "2026-11-05T10:00:03.000Z");
});

test("every rejected status transition returns 409 and preserves task fields and timestamp", async () => {
  const rejectedTransitions = [
    ["Pending", "Pending"],
    ["Pending", "Completed"],
    ["InProgress", "Pending"],
    ["InProgress", "InProgress"],
    ["Completed", "Pending"],
    ["Completed", "Completed"],
  ];

  for (const [currentStatus, requestedStatus] of rejectedTransitions) {
    const task = { ...initialTask, status: currentStatus };
    const store = createMemoryStore([task]);
    const service = createTaskService({
      store,
      now: createClockSource("2026-11-05T10:00:01.000Z"),
    });

    await assert.rejects(
      service.updateTaskStatus("task-1", { status: requestedStatus }),
      { status: 409, code: "INVALID_STATUS_TRANSITION" },
    );
    assert.deepEqual(await service.getTask("task-1"), task);
    assert.deepEqual(await store.readTasks(), [task]);
  }
});

test("status update rejects invalid request values without changing the task", async () => {
  const { service } = createService();
  const before = await service.getTask("task-1");

  for (const body of [{}, { status: "In Progress" }, { status: "Completed", extra: true }]) {
    await assert.rejects(service.updateTaskStatus("task-1", body), {
      code: "VALIDATION_ERROR",
    });
  }
  assert.deepEqual(await service.getTask("task-1"), before);
});
