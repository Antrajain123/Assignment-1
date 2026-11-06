import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import test from "node:test";
import { createTemporaryStore } from "../helpers/temporary-store.js";
import { createJsonTaskStore } from "../../src/persistence/json-task-store.js";

const task = {
  id: "task-1",
  title: "Prepare notes",
  description: "",
  priority: "Medium",
  status: "Pending",
  tags: [],
  createdAt: "2026-11-05T10:00:00.000Z",
  updatedAt: "2026-11-05T10:00:00.000Z",
};

test("missing JSON file initializes to an empty task collection", async (t) => {
  const temporary = await createTemporaryStore();
  t.after(temporary.cleanup);
  const store = createJsonTaskStore({ filePath: temporary.filePath });

  assert.deepEqual(await store.readTasks(), []);
  assert.deepEqual(JSON.parse(await readFile(temporary.filePath, "utf8")), { tasks: [] });
});

test("store reads a valid persisted task collection", async (t) => {
  const temporary = await createTemporaryStore({ initialData: { tasks: [task] } });
  t.after(temporary.cleanup);
  const store = createJsonTaskStore({ filePath: temporary.filePath });

  assert.deepEqual(await store.readTasks(), [task]);
});

test("store fails closed on malformed JSON without changing the original bytes", async (t) => {
  const original = '{"tasks":[\n';
  const temporary = await createTemporaryStore({ initialData: original });
  t.after(temporary.cleanup);
  const store = createJsonTaskStore({ filePath: temporary.filePath });

  await assert.rejects(store.readTasks(), /not valid JSON/);
  assert.equal(await readFile(temporary.filePath, "utf8"), original);
});

test("store rejects offset timestamps without changing the original file", async (t) => {
  const invalidTask = { ...task, createdAt: "2026-11-05T10:00:00+05:30" };
  const original = `${JSON.stringify({ tasks: [invalidTask] }, null, 2)}\n`;
  const temporary = await createTemporaryStore({ initialData: original });
  t.after(temporary.cleanup);
  const store = createJsonTaskStore({ filePath: temporary.filePath });

  await assert.rejects(store.readTasks(), /createdAt must be an ISO 8601 UTC timestamp/);
  assert.equal(await readFile(temporary.filePath, "utf8"), original);
});

test("store serializes concurrent mutations without losing updates", async (t) => {
  const temporary = await createTemporaryStore({ initialData: { tasks: [] } });
  t.after(temporary.cleanup);
  const store = createJsonTaskStore({ filePath: temporary.filePath });
  let releaseFirstMutation;
  const firstMutationPaused = new Promise((resolve) => {
    releaseFirstMutation = resolve;
  });
  const firstStarted = new Promise((resolve) => {
    store.mutateTasks(async (tasks) => {
      resolve();
      await firstMutationPaused;
      return [...tasks, task];
    });
  });

  await firstStarted;
  const secondMutation = store.mutateTasks((tasks) => [
    ...tasks,
    { ...task, id: "task-2", title: "Review notes" },
  ]);
  releaseFirstMutation();
  await secondMutation;

  assert.deepEqual(
    (await store.readTasks()).map(({ id }) => id),
    ["task-1", "task-2"],
  );
});

test("failed atomic replacement preserves the last valid file", async (t) => {
  const original = JSON.stringify({ tasks: [task] }, null, 2);
  const temporary = await createTemporaryStore();
  await writeFile(temporary.filePath, original, "utf8");
  t.after(temporary.cleanup);
  const store = createJsonTaskStore({
    filePath: temporary.filePath,
    renameFile: async () => {
      throw new Error("simulated replacement failure");
    },
  });

  await assert.rejects(
    store.mutateTasks((tasks) => [...tasks, { ...task, id: "task-2" }]),
    /simulated replacement failure/,
  );
  assert.equal(await readFile(temporary.filePath, "utf8"), original);
});
