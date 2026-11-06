import assert from "node:assert/strict";
import { createServer } from "node:http";
import { performance } from "node:perf_hooks";
import { test } from "node:test";
import { createApp } from "../../src/app.js";
import { createTemporaryStore } from "../helpers/temporary-store.js";

function createTask(index) {
  const minutes = Math.floor(index / 60);
  const seconds = index % 60;
  const timestamp = `2026-11-05T10:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.000Z`;
  const priorities = ["Low", "Medium", "High"];

  return {
    id: `performance-${String(index).padStart(4, "0")}`,
    title: `Performance fixture ${index}`,
    description: "",
    priority: priorities[index % priorities.length],
    status: "Pending",
    tags: [`group-${index % 10}`],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
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

test("list, filter, and sort 1,000 deterministic tasks in under one second each", async (t) => {
  const tasks = Array.from({ length: 1000 }, (_, index) => createTask(index));
  const temporary = await createTemporaryStore({ initialData: { tasks } });
  t.after(temporary.cleanup);

  const app = createApp({ config: { dataFilePath: temporary.filePath } });
  const running = await listen(app);
  t.after(() => running.close());

  await fetch(`${running.baseUrl}/tasks`);
  const measurements = [];
  for (const [query, expectedCount] of [["", 1000], ["?tag=group-0", 100], ["?sort=priority", 1000]]) {
    const startedAt = performance.now();
    const response = await fetch(`${running.baseUrl}/tasks${query}`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    const elapsedMilliseconds = performance.now() - startedAt;

    assert.equal(payload.data.length, expectedCount);
    assert(
      elapsedMilliseconds < 1000,
      `${query || "list"} took ${elapsedMilliseconds.toFixed(2)}ms; expected under 1000ms`,
    );
    measurements.push(`${query || "list"}=${elapsedMilliseconds.toFixed(2)}ms`);
  }
  t.diagnostic(`1,000-task API timings: ${measurements.join(", ")}`);
});
