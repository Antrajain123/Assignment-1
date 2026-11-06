import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import { createApp } from "../../src/app.js";
import { createClockSource, createIdSource } from "../helpers/deterministic-sources.js";
import { createTemporaryStore } from "../helpers/temporary-store.js";

let temporary;
let server;
let baseUrl;

before(async () => {
  temporary = await createTemporaryStore();
  const app = createApp({
    config: { dataFilePath: temporary.filePath },
    createId: createIdSource("api-task"),
    now: createClockSource("2026-11-05T10:00:00.000Z", 1000),
  });
  server = createServer(app);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await temporary?.cleanup();
});

async function request(path, options) {
  return fetch(new URL(path, baseUrl), options);
}

async function createTask(body) {
  return request("/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function documentedResponseCodes(openapi, path, method) {
  const lines = openapi.split("\n");
  const pathLine = lines.indexOf(`  ${path}:`);
  assert.notEqual(pathLine, -1, `OpenAPI path ${path} must exist`);
  const operationLine = lines.findIndex(
    (line, index) => index > pathLine && line === `    ${method}:`,
  );
  assert.notEqual(operationLine, -1, `OpenAPI ${method.toUpperCase()} ${path} must exist`);

  const responseCodes = [];
  for (let index = operationLine + 1; index < lines.length; index += 1) {
    if (/^    (get|post|patch|delete):$/.test(lines[index]) || /^  \S/.test(lines[index])) {
      break;
    }
    const match = lines[index].match(/^        "(\d{3})":$/);
    if (match) {
      responseCodes.push(Number(match[1]));
    }
  }
  return responseCodes;
}

function assertTaskResponse(task) {
  assert.deepEqual(Object.keys(task).sort(), [
    "createdAt",
    "description",
    "id",
    "priority",
    "status",
    "tags",
    "title",
    "updatedAt",
  ]);
  assert.equal(typeof task.id, "string");
  assert.equal(typeof task.title, "string");
  assert.equal(typeof task.description, "string");
  assert(["Low", "Medium", "High"].includes(task.priority));
  assert(["Pending", "InProgress", "Completed"].includes(task.status));
  assert(Array.isArray(task.tags));
}

test("POST /tasks creates a task with contract defaults and UTC timestamps", async () => {
  const response = await createTask({ title: "Prepare notes" });
  assert.equal(response.status, 201);

  const payload = await response.json();
  assert.deepEqual(Object.keys(payload), ["data"]);
  const { data: task } = payload;
  assertTaskResponse(task);
  assert.equal(task.title, "Prepare notes");
  assert.equal(task.description, "");
  assert.equal(task.priority, "Medium");
  assert.equal(task.status, "Pending");
  assert.deepEqual(task.tags, []);
  assert.match(task.createdAt, /Z$/);
  assert.match(task.updatedAt, /Z$/);
  assert.equal(task.createdAt, "2026-11-05T10:00:00.000Z");
  assert.equal(task.id, "api-task-1");

  const listed = await request("/tasks");
  assert.deepEqual((await listed.json()).data, [task]);
});

test("POST /tasks preserves custom task values and normalized tags", async () => {
  const response = await createTask({
    title: "Plan trip",
    description: "Compare dates",
    priority: "High",
    tags: ["Travel", "travel", "Family"],
  });
  assert.equal(response.status, 201);

  const { data } = await response.json();
  assertTaskResponse(data);
  assert.equal(data.description, "Compare dates");
  assert.equal(data.priority, "High");
  assert.equal(data.status, "Pending");
  assert.deepEqual(data.tags, ["Travel", "Family"]);
});

test("POST /tasks rejects missing, empty, and whitespace titles without changing state", async () => {
  for (const body of [{}, { title: "" }, { title: " \t " }]) {
    const response = await createTask(body);
    assert.equal(response.status, 400);
    assert.deepEqual(Object.keys(await response.json()), ["error"]);
  }

  const listed = await request("/tasks");
  assert.equal((await listed.json()).data.length, 2);
});

test("GET /tasks returns tasks and applies exact case-insensitive tag filtering", async () => {
  await createTask({ title: "Work item", tags: ["Work"] });
  await createTask({ title: "Lowercase work item", tags: ["work"] });
  await createTask({ title: "Home item", tags: ["Home"] });
  await createTask({ title: "Workshop item", tags: ["workshop"] });

  const filtered = await request("/tasks?tag=WORK");
  assert.equal(filtered.status, 200);
  const filteredPayload = await filtered.json();
  assert.deepEqual(Object.keys(filteredPayload), ["data"]);
  filteredPayload.data.forEach(assertTaskResponse);
  assert.deepEqual(
    filteredPayload.data.map(({ title }) => title),
    ["Work item", "Lowercase work item"],
  );
  assert.equal((await (await request("/tasks")).json()).data.length, 6);
});

test("GET /tasks?sort=priority orders by priority, creation time, then ID", async () => {
  const temporarySort = await createTemporaryStore({
    initialData: {
      tasks: [
        {
          id: "medium",
          title: "Medium",
          description: "",
          priority: "Medium",
          status: "Pending",
          tags: [],
          createdAt: "2026-11-05T10:00:00.000Z",
          updatedAt: "2026-11-05T10:00:00.000Z",
        },
        {
          id: "high-z",
          title: "High later",
          description: "",
          priority: "High",
          status: "Pending",
          tags: [],
          createdAt: "2026-11-05T10:00:01.000Z",
          updatedAt: "2026-11-05T10:00:01.000Z",
        },
        {
          id: "low",
          title: "Low",
          description: "",
          priority: "Low",
          status: "Pending",
          tags: [],
          createdAt: "2026-11-05T09:00:00.000Z",
          updatedAt: "2026-11-05T09:00:00.000Z",
        },
        {
          id: "high-b",
          title: "High tie B",
          description: "",
          priority: "High",
          status: "Pending",
          tags: [],
          createdAt: "2026-11-05T10:00:00.000Z",
          updatedAt: "2026-11-05T10:00:00.000Z",
        },
        {
          id: "high-a",
          title: "High tie A",
          description: "",
          priority: "High",
          status: "Pending",
          tags: [],
          createdAt: "2026-11-05T10:00:00.000Z",
          updatedAt: "2026-11-05T10:00:00.000Z",
        },
      ],
    },
  });
  const testApp = createApp({ config: { dataFilePath: temporarySort.filePath } });
  const testServer = createServer(testApp);
  await new Promise((resolve, reject) => {
    testServer.once("error", reject);
    testServer.listen(0, "127.0.0.1", resolve);
  });

  try {
    const response = await fetch(
      `http://127.0.0.1:${testServer.address().port}/tasks?sort=priority`,
    );
    assert.equal(response.status, 200);
    assert.deepEqual(
      (await response.json()).data.map(({ id }) => id),
      ["high-a", "high-b", "high-z", "medium", "low"],
    );
  } finally {
    await new Promise((resolve, reject) => {
      testServer.close((error) => (error ? reject(error) : resolve()));
    });
    await temporarySort.cleanup();
  }
});

test("GET /tasks/{id} returns only the requested task and unknown IDs use the error contract", async () => {
  const list = (await (await request("/tasks")).json()).data;
  const requested = list[1];
  const found = await request(`/tasks/${requested.id}`);
  assert.equal(found.status, 200);
  const foundPayload = await found.json();
  assert.deepEqual(Object.keys(foundPayload), ["data"]);
  assertTaskResponse(foundPayload.data);
  assert.deepEqual(foundPayload, { data: requested });

  const missing = await request("/tasks/unknown-id");
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), {
    error: { code: "TASK_NOT_FOUND", message: "Task not found" },
  });
});

test("successful task responses satisfy the timestamp constraints declared by OpenAPI", async () => {
  const openapi = await readFile(
    new URL("../../specs/001-task-management-api/contracts/openapi.yaml", import.meta.url),
    "utf8",
  );
  const timestampPatterns = [
    ...openapi.matchAll(/^\s+pattern: '([^']+Z\$)'$/gm),
  ].map(([, pattern]) => new RegExp(pattern));
  assert.equal(timestampPatterns.length, 2);
  assert(timestampPatterns.every((pattern) => !pattern.test("2026-11-05T10:00:00+05:30")));

  const response = await request("/tasks");
  const { data } = await response.json();
  for (const task of data) {
    assert(timestampPatterns.every((pattern) => pattern.test(task.createdAt)));
    assert(timestampPatterns.every((pattern) => pattern.test(task.updatedAt)));
  }
});

test("implemented HTTP methods and observed responses agree with the OpenAPI contract", async () => {
  const openapi = await readFile(
    new URL("../../specs/001-task-management-api/contracts/openapi.yaml", import.meta.url),
    "utf8",
  );
  const documentedOperations = [
    ["/tasks", "get", [200, 400, 500]],
    ["/tasks", "post", [201, 400, 413, 500]],
    ["/tasks/{id}", "get", [200, 404, 500]],
    ["/tasks/{id}", "patch", [200, 400, 413, 404, 500]],
    ["/tasks/{id}", "delete", [200, 404, 500]],
    ["/tasks/{id}/status", "patch", [200, 400, 413, 404, 409, 500]],
  ];
  for (const [path, method, expectedCodes] of documentedOperations) {
    assert.deepEqual(
      documentedResponseCodes(openapi, path, method).sort((left, right) => left - right),
      [...expectedCodes].sort((left, right) => left - right),
      `${method.toUpperCase()} ${path} documented status codes`,
    );
  }
  assert.match(
    openapi,
    /required: \[id, title, description, priority, status, tags, createdAt, updatedAt\]/,
  );
  assert.match(openapi, /enum: \[Low, Medium, High\]/);
  assert.match(openapi, /enum: \[Pending, InProgress, Completed\]/);
  assert.match(openapi, /required: \[title\]/);
  assert.match(openapi, /minProperties: 1/);
  assert.match(
    openapi,
    /- VALIDATION_ERROR\s+- INVALID_JSON\s+- TASK_NOT_FOUND\s+- INVALID_STATUS_TRANSITION\s+- PAYLOAD_TOO_LARGE\s+- INTERNAL_ERROR/,
  );

  const created = await createTask({ title: "Contract parity task" });
  assert.equal(created.status, 201);
  const task = (await created.json()).data;
  assertTaskResponse(task);

  const list = await request("/tasks");
  assert.equal(list.status, 200);
  assert((await list.json()).data.some(({ id }) => id === task.id));

  const detail = await request(`/tasks/${task.id}`);
  assert.equal(detail.status, 200);
  assertTaskResponse((await detail.json()).data);

  const update = await request(`/tasks/${task.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ description: "Contract update" }),
  });
  assert.equal(update.status, 200);
  const updatedPayload = await update.json();
  assert.deepEqual(Object.keys(updatedPayload), ["data"]);
  assertTaskResponse(updatedPayload.data);

  const status = await request(`/tasks/${task.id}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "InProgress" }),
  });
  assert.equal(status.status, 200);
  const statusPayload = await status.json();
  assert.deepEqual(Object.keys(statusPayload), ["data"]);
  assertTaskResponse(statusPayload.data);

  const rejectedTransition = await request(`/tasks/${task.id}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "Pending" }),
  });
  assert.equal(rejectedTransition.status, 409);

  const invalidUpdate = await request(`/tasks/${task.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ priority: "Urgent" }),
  });
  assert.equal(invalidUpdate.status, 400);

  const deleted = await request(`/tasks/${task.id}`, { method: "DELETE" });
  assert.equal(deleted.status, 200);
  assert.deepEqual(await deleted.json(), { data: { id: task.id, deleted: true } });
  assert.equal((await request(`/tasks/${task.id}`)).status, 404);
});

test("PATCH /tasks/{id} updates permitted fields and rejects invalid updates atomically", async () => {
  const created = await (await createTask({ title: "Editable task", tags: ["Work"] })).json();
  const updateResponse = await request(`/tasks/${created.data.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: " Updated title ",
      description: "",
      priority: "High",
      tags: ["Home", "home", "Urgent"],
    }),
  });
  assert.equal(updateResponse.status, 200);
  const updated = (await updateResponse.json()).data;
  assertTaskResponse(updated);
  assert.equal(updated.title, "Updated title");
  assert.equal(updated.description, "");
  assert.equal(updated.priority, "High");
  assert.deepEqual(updated.tags, ["Home", "Urgent"]);
  assert.notEqual(updated.updatedAt, created.data.updatedAt);
  assert.match(updated.updatedAt, /Z$/);

  for (const invalid of [{}, { title: " " }, { priority: "Urgent" }, { status: "Completed" }]) {
    const response = await request(`/tasks/${created.data.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(invalid),
    });
    assert.equal(response.status, 400);
    const errorPayload = await response.json();
    assert.deepEqual(Object.keys(errorPayload), ["error"]);
    assert.equal(errorPayload.error.code, "VALIDATION_ERROR");
    assert.equal(typeof errorPayload.error.message, "string");
    const current = (await (await request(`/tasks/${created.data.id}`)).json()).data;
    assert.deepEqual(current, updated);
  }

  const missing = await request("/tasks/missing-update", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Changed" }),
  });
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, "TASK_NOT_FOUND");
});

test("DELETE /tasks/{id} deletes existing tasks and returns not found for missing IDs", async () => {
  const created = await (await createTask({ title: "Delete me" })).json();
  const deleted = await request(`/tasks/${created.data.id}`, { method: "DELETE" });

  assert.equal(deleted.status, 200);
  assert.deepEqual(await deleted.json(), {
    data: { id: created.data.id, deleted: true },
  });
  assert.equal(
    (await (await request("/tasks")).json()).data.some(({ id }) => id === created.data.id),
    false,
  );

  const missing = await request("/tasks/missing-delete", { method: "DELETE" });
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, "TASK_NOT_FOUND");
});

test("PATCH /tasks/{id}/status accepts each permitted transition and advances UTC timestamps", async () => {
  const created = await (await createTask({ title: "Advance status" })).json();
  let task = created.data;

  for (const status of ["InProgress", "Completed", "InProgress"]) {
    const response = await request(`/tasks/${task.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    assert.equal(response.status, 200);
    const nextTask = (await response.json()).data;
    assertTaskResponse(nextTask);
    assert.equal(nextTask.status, status);
    assert.notEqual(nextTask.updatedAt, task.updatedAt);
    assert.match(nextTask.updatedAt, /Z$/);
    task = nextTask;
  }
});

test("rejected status transitions return 409 and preserve the task and updatedAt", async () => {
  const rejectedTransitions = [
    ["Pending", "Pending"],
    ["Pending", "Completed"],
    ["InProgress", "Pending"],
    ["InProgress", "InProgress"],
    ["Completed", "Pending"],
    ["Completed", "Completed"],
  ];

  for (const [currentStatus, requestedStatus] of rejectedTransitions) {
    const created = await (await createTask({ title: `Rejected ${currentStatus}` })).json();
    let task = created.data;
    if (currentStatus === "InProgress") {
      task = (
        await (
          await request(`/tasks/${task.id}/status`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status: "InProgress" }),
          })
        ).json()
      ).data;
    } else if (currentStatus === "Completed") {
      task = (
        await (
          await request(`/tasks/${task.id}/status`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status: "InProgress" }),
          })
        ).json()
      ).data;
      task = (
        await (
          await request(`/tasks/${task.id}/status`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status: "Completed" }),
          })
        ).json()
      ).data;
    }

    const response = await request(`/tasks/${task.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: requestedStatus }),
    });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, "INVALID_STATUS_TRANSITION");
    const after = (await (await request(`/tasks/${task.id}`)).json()).data;
    assert.deepEqual(after, task);
    assert.equal(after.updatedAt, task.updatedAt);
  }

  const missing = await request("/tasks/missing-status/status", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "InProgress" }),
  });
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, "TASK_NOT_FOUND");
});
