import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { test } from "node:test";
import { createApp } from "../../src/app.js";
import { createJsonTaskStore } from "../../src/persistence/json-task-store.js";
import { createTemporaryStore } from "../helpers/temporary-store.js";

function serializedBodyOfBytes(size) {
  const prefix = '{"title":"x","description":"';
  const suffix = '"}';
  const contentBytes = size - Buffer.byteLength(prefix + suffix);
  const content = `${"é".repeat(Math.floor(contentBytes / 2))}${"a".repeat(contentBytes % 2)}`;
  const body = `${prefix}${content}${suffix}`;
  assert.equal(Buffer.byteLength(body, "utf8"), size);
  return body;
}

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

test("malformed JSON, invalid records, and offset timestamps fail closed without rewriting bytes", async (t) => {
  const temporary = await createTemporaryStore();
  t.after(temporary.cleanup);

  const badDocuments = [
    '{"tasks":[\n',
    JSON.stringify({
      tasks: [
        {
          id: "offset-task",
          title: "Unsafe timestamp",
          description: "",
          priority: "Medium",
          status: "Pending",
          tags: [],
          createdAt: "2026-11-05T10:00:00+05:30",
          updatedAt: "2026-11-05T10:00:00.000Z",
        },
      ],
    }),
    JSON.stringify({ unexpected: [] }),
  ];

  for (const original of badDocuments) {
    await writeFile(temporary.filePath, original, "utf8");
    const store = createJsonTaskStore({ filePath: temporary.filePath });
    const app = createApp({
      config: { dataFilePath: temporary.filePath },
      store,
    });

    await assert.rejects(store.readTasks());
    assert.equal(await readFile(temporary.filePath, "utf8"), original);
    const running = await listen(app);
    try {
      const response = await fetch(`${running.baseUrl}/tasks`);
      assert.equal(response.status, 500);
      assert.equal((await response.json()).error.code, "INTERNAL_ERROR");
      assert.equal(await readFile(temporary.filePath, "utf8"), original);
    } finally {
      await running.close();
    }
  }
});

test("server startup rejects invalid persisted data before binding a listener", async (t) => {
  const invalidTask = {
    id: "invalid-task",
    title: "Invalid",
    description: "",
    priority: "Medium",
    status: "Pending",
    tags: [],
    createdAt: "2026-11-05T10:00:00.000Z",
    updatedAt: "2026-11-05T10:00:00.000Z",
  };
  const invalidDocuments = [
    '{"tasks":[\n',
    JSON.stringify({ tasks: [{ ...invalidTask, createdAt: "2026-11-05T10:00:00+05:30" }] }),
    JSON.stringify({ invalid: [] }),
    JSON.stringify({ tasks: [invalidTask, invalidTask] }),
  ];
  const temporary = await createTemporaryStore();
  t.after(temporary.cleanup);

  for (const original of invalidDocuments) {
    await writeFile(temporary.filePath, original, "utf8");
    const result = spawnSync(process.execPath, ["src/server.js"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        DAYFLOW_DATA_FILE: temporary.filePath,
        PORT: "0",
      },
      timeout: 5000,
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /stored task data is invalid or unavailable/);
    assert.doesNotMatch(result.stderr, /createdAt|UTC timestamp|stack|node_modules/);
    assert.equal(await readFile(temporary.filePath, "utf8"), original);
  }
});

test("1 MiB UTF-8 limits accept at/below-boundary create bodies and reject the next byte", async (t) => {
  const temporary = await createTemporaryStore();
  t.after(temporary.cleanup);
  const app = createApp({ config: { dataFilePath: temporary.filePath } });
  const running = await listen(app);
  t.after(() => running.close());

  for (const size of [1_048_575, 1_048_576]) {
    const response = await fetch(`${running.baseUrl}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: serializedBodyOfBytes(size),
    });
    assert.equal(response.status, 201, `expected ${size}-byte request to reach normal handling`);
    assert.match((await response.json()).data.createdAt, /Z$/);
  }

  const oversized = await fetch(`${running.baseUrl}/tasks`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: serializedBodyOfBytes(1_048_577),
  });
  assert.equal(oversized.status, 413);
  assert.deepEqual((await oversized.json()).error.code, "PAYLOAD_TOO_LARGE");
  assert.equal((await app.locals.taskStore.readTasks()).length, 2);
});

test("oversized update and status bodies return 413 without changing task data", async (t) => {
  const temporary = await createTemporaryStore();
  t.after(temporary.cleanup);
  const app = createApp({ config: { dataFilePath: temporary.filePath } });
  const running = await listen(app);
  t.after(() => running.close());

  const created = await fetch(`${running.baseUrl}/tasks`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Protect me" }),
  });
  const before = (await created.json()).data;

  for (const path of [`/tasks/${before.id}`, `/tasks/${before.id}/status`]) {
    const response = await fetch(`${running.baseUrl}${path}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: serializedBodyOfBytes(1_048_577),
    });
    assert.equal(response.status, 413);
    assert.equal((await response.json()).error.code, "PAYLOAD_TOO_LARGE");
    const current = await fetch(`${running.baseUrl}/tasks/${before.id}`);
    assert.deepEqual((await current.json()).data, before);
  }
});

test("request input cannot select storage files or use task IDs as file paths", async (t) => {
  const temporary = await createTemporaryStore();
  t.after(temporary.cleanup);
  const app = createApp({ config: { dataFilePath: temporary.filePath } });
  const running = await listen(app);
  t.after(() => running.close());

  const invalidCreate = await fetch(`${running.baseUrl}/tasks`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Attempt", dataFilePath: "/tmp/other.json" }),
  });
  assert.equal(invalidCreate.status, 400);
  assert.equal((await invalidCreate.json()).error.code, "VALIDATION_ERROR");

  const queryPath = await fetch(`${running.baseUrl}/tasks?path=../other.json`);
  assert.equal(queryPath.status, 400);
  assert.equal((await queryPath.json()).error.code, "VALIDATION_ERROR");

  const traversal = await fetch(`${running.baseUrl}/tasks/%2e%2e%2fother.json`);
  assert.equal(traversal.status, 404);
  assert.equal((await traversal.json()).error.code, "TASK_NOT_FOUND");
  assert.deepEqual(await app.locals.taskStore.readTasks(), []);
});
