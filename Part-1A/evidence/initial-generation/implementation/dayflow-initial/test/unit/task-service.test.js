import assert from "node:assert/strict";
import test from "node:test";
import { createClockSource, createIdSource } from "../helpers/deterministic-sources.js";
import { createTaskService } from "../../src/services/task-service.js";

function createMemoryStore(initialTasks = []) {
  const cloneTasks = (tasksToClone) =>
    tasksToClone.map((task) => ({ ...task, tags: [...task.tags] }));
  let tasks = cloneTasks(initialTasks);

  return {
    async readTasks() {
      return cloneTasks(tasks);
    },
    async mutateTasks(mutator) {
      const candidate = await mutator(cloneTasks(tasks));
      tasks = cloneTasks(candidate);
      return cloneTasks(tasks);
    },
  };
}

function makeTask(id, priority, createdAt, tags = []) {
  return {
    id,
    title: id,
    description: "",
    priority,
    status: "Pending",
    tags,
    createdAt,
    updatedAt: createdAt,
  };
}

test("create applies defaults, generated IDs, and injected UTC timestamps", async () => {
  const service = createTaskService({
    store: createMemoryStore(),
    createId: createIdSource("generated"),
    now: createClockSource("2026-11-05T10:00:00.000Z"),
  });

  const task = await service.createTask({ title: "  Prepare notes  " });

  assert.deepEqual(task, {
    id: "generated-1",
    title: "Prepare notes",
    description: "",
    priority: "Medium",
    status: "Pending",
    tags: [],
    createdAt: "2026-11-05T10:00:00.000Z",
    updatedAt: "2026-11-05T10:00:00.000Z",
  });
});

test("create preserves custom priority, description, and tags", async () => {
  const service = createTaskService({
    store: createMemoryStore(),
    createId: () => "generated-1",
    now: () => "2026-11-05T10:00:00.000Z",
  });

  const task = await service.createTask({
    title: "Plan trip",
    description: "Compare dates",
    priority: "High",
    tags: ["Travel", "travel", "Family"],
  });

  assert.deepEqual(
    { description: task.description, priority: task.priority, tags: task.tags },
    { description: "Compare dates", priority: "High", tags: ["Travel", "Family"] },
  );
});

test("invalid creation does not mutate the task collection", async () => {
  const store = createMemoryStore();
  const service = createTaskService({
    store,
    createId: createIdSource(),
    now: createClockSource(),
  });

  for (const body of [{}, { title: "" }, { title: " \t " }]) {
    await assert.rejects(service.createTask(body), { code: "VALIDATION_ERROR" });
  }
  assert.deepEqual(await store.readTasks(), []);
});

test("list returns tasks and filters tags by exact case-insensitive match", async () => {
  const store = createMemoryStore([
    makeTask("task-1", "Low", "2026-11-05T10:00:00.000Z", ["Work"]),
    makeTask("task-2", "High", "2026-11-05T10:00:01.000Z", ["Home"]),
    makeTask("task-3", "Medium", "2026-11-05T10:00:02.000Z", ["workshop"]),
    makeTask("task-4", "Low", "2026-11-05T10:00:03.000Z", ["work"]),
  ]);
  const service = createTaskService({ store });

  assert.equal((await service.listTasks()).length, 4);
  assert.deepEqual(
    (await service.listTasks({ tag: "WORK" })).map(({ id }) => id),
    ["task-1", "task-4"],
  );
  assert.deepEqual(await service.listTasks({ tag: "work " }), []);
});

test("priority sort uses priority, oldest creation time, then ascending ID", async () => {
  const store = createMemoryStore([
    makeTask("medium", "Medium", "2026-11-05T10:00:00.000Z"),
    makeTask("high-z", "High", "2026-11-05T10:00:01.000Z"),
    makeTask("low", "Low", "2026-11-05T09:00:00.000Z"),
    makeTask("high-b", "High", "2026-11-05T10:00:00.000Z"),
    makeTask("high-a", "High", "2026-11-05T10:00:00.000Z"),
  ]);
  const service = createTaskService({ store });

  assert.deepEqual(
    (await service.listTasks({ sort: "priority" })).map(({ id }) => id),
    ["high-a", "high-b", "high-z", "medium", "low"],
  );
});

test("priority sort compares task IDs by Unicode code point", async () => {
  const timestamp = "2026-11-05T10:00:00.000Z";
  const store = createMemoryStore([
    makeTask("\u{10000}", "High", timestamp),
    makeTask("\uE000", "High", timestamp),
  ]);
  const service = createTaskService({ store });

  assert.deepEqual(
    (await service.listTasks({ sort: "priority" })).map(({ id }) => id),
    ["\uE000", "\u{10000}"],
  );
});

test("get returns the requested task or rejects with a not-found API error", async () => {
  const store = createMemoryStore([makeTask("task-1", "Medium", "2026-11-05T10:00:00.000Z")]);
  const service = createTaskService({ store });

  assert.equal((await service.getTask("task-1")).id, "task-1");
  await assert.rejects(service.getTask("unknown"), { status: 404, code: "TASK_NOT_FOUND" });
});
