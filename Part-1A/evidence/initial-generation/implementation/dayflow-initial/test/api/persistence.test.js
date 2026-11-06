import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { createApp } from "../../src/app.js";
import { createJsonTaskStore } from "../../src/persistence/json-task-store.js";
import { createClockSource, createIdSource } from "../helpers/deterministic-sources.js";
import { createTemporaryStore } from "../helpers/temporary-store.js";

async function listen(app) {
  const server = createServer(app);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

test("tasks and latest updates remain available after recreating the app with the same store", async (t) => {
  const temporary = await createTemporaryStore();
  t.after(temporary.cleanup);
  const store = createJsonTaskStore({ filePath: temporary.filePath });
  const firstApp = createApp({
    config: { dataFilePath: temporary.filePath },
    store,
    createId: createIdSource("persistent"),
    now: createClockSource("2026-11-05T10:00:00.000Z", 1000),
  });
  const first = await listen(firstApp);
  let task;

  try {
    const created = await fetch(`${first.baseUrl}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Persist me", priority: "High", tags: ["Work"] }),
    });
    assert.equal(created.status, 201);
    task = (await created.json()).data;

    const updated = await fetch(`${first.baseUrl}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description: "Latest saved detail" }),
    });
    assert.equal(updated.status, 200);
    task = (await updated.json()).data;
    assert.match(task.createdAt, /Z$/);
    assert.match(task.updatedAt, /Z$/);
    assert.notEqual(task.createdAt, task.updatedAt);
  } finally {
    await first.close();
  }

  const restartedApp = createApp({
    config: { dataFilePath: temporary.filePath },
    store: createJsonTaskStore({ filePath: temporary.filePath }),
  });
  const restarted = await listen(restartedApp);
  try {
    const list = await fetch(`${restarted.baseUrl}/tasks`);
    const detail = await fetch(`${restarted.baseUrl}/tasks/${task.id}`);
    assert.equal(list.status, 200);
    assert.equal(detail.status, 200);
    assert.deepEqual((await list.json()).data, [task]);
    assert.deepEqual((await detail.json()).data, task);
    assert.match(task.createdAt, /Z$/);
    assert.match(task.updatedAt, /Z$/);
  } finally {
    await restarted.close();
  }
});
