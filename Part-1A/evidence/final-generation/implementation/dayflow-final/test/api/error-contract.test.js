import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { createApp } from "../../src/app.js";
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

function assertErrorContract(response, status, code) {
  assert.equal(response.status, status);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/);
  const payloadPromise = response.json();

  return payloadPromise.then((payload) => {
    assert.deepEqual(Object.keys(payload), ["error"]);
    assert.deepEqual(Object.keys(payload.error).sort(), ["code", "message"]);
    assert.equal(payload.error.code, code);
    assert.equal(typeof payload.error.message, "string");
    assert(payload.error.message.length > 0);
    assert.doesNotMatch(JSON.stringify(payload), /stack|Error:|node_modules|\/home\/|\/tmp\//i);
    return payload;
  });
}

test("request parse, validation, missing task, and transition failures use standard errors", async (t) => {
  const temporary = await createTemporaryStore();
  t.after(temporary.cleanup);
  const app = createApp({ config: { dataFilePath: temporary.filePath } });
  const running = await listen(app);
  t.after(() => running.close());

  const malformed = await fetch(`${running.baseUrl}/tasks`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  await assertErrorContract(malformed, 400, "INVALID_JSON");

  const invalid = await fetch(`${running.baseUrl}/tasks`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: " " }),
  });
  await assertErrorContract(invalid, 400, "VALIDATION_ERROR");

  const missing = await fetch(`${running.baseUrl}/tasks/unknown`);
  await assertErrorContract(missing, 404, "TASK_NOT_FOUND");
  await assertErrorContract(
    await fetch(`${running.baseUrl}/tasks/unknown`, { method: "DELETE" }),
    404,
    "TASK_NOT_FOUND",
  );

  const created = await fetch(`${running.baseUrl}/tasks`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Status task" }),
  });
  const task = (await created.json()).data;
  const rejected = await fetch(`${running.baseUrl}/tasks/${task.id}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "Completed" }),
  });
  await assertErrorContract(rejected, 409, "INVALID_STATUS_TRANSITION");

  await assertErrorContract(
    await fetch(`${running.baseUrl}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: " " }),
    }),
    400,
    "VALIDATION_ERROR",
  );
  await assertErrorContract(
    await fetch(`${running.baseUrl}/tasks/${task.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "In Progress" }),
    }),
    400,
    "VALIDATION_ERROR",
  );
});

test("unexpected errors return generic JSON without exposing implementation details", async (t) => {
  const app = createApp({
    config: { dataFilePath: "/private/internal/path/tasks.json" },
    store: {
      async readTasks() {
        throw new Error("sensitive /private/internal/path/tasks.json stack details");
      },
      async mutateTasks() {
        throw new Error("sensitive internal persistence detail");
      },
    },
  });
  const running = await listen(app);
  t.after(() => running.close());

  const originalError = console.error;
  const logged = [];
  console.error = (...parts) => logged.push(parts.join(" "));
  try {
    const response = await fetch(`${running.baseUrl}/tasks`);
    const payload = await assertErrorContract(response, 500, "INTERNAL_ERROR");
    assert.equal(payload.error.message, "An unexpected error occurred");
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(logged, ["DayFlow request failed: INTERNAL_ERROR"]);
});

test("oversized JSON body returns the documented payload-too-large contract", async (t) => {
  const temporary = await createTemporaryStore();
  t.after(temporary.cleanup);
  const app = createApp({ config: { dataFilePath: temporary.filePath } });
  const running = await listen(app);
  t.after(() => running.close());
  const prefix = '{"title":"';
  const suffix = '"}';
  const body = `${prefix}${"a".repeat(1_048_577 - Buffer.byteLength(prefix + suffix))}${suffix}`;
  assert.equal(Buffer.byteLength(body), 1_048_577);

  await assertErrorContract(
    await fetch(`${running.baseUrl}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }),
    413,
    "PAYLOAD_TOO_LARGE",
  );
});
