import { pathToFileURL } from "node:url";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createJsonTaskStore } from "./persistence/json-task-store.js";

export async function startServer() {
  const config = loadConfig();
  const store = createJsonTaskStore({ filePath: config.dataFilePath });

  await store.readTasks();
  const app = createApp({ config, store });
  return new Promise((resolve, reject) => {
    const server = app.listen(config.port, config.host, () => {
      console.log(`DayFlow listening on http://${config.host}:${server.address().port}`);
      resolve(server);
    });
    server.once("error", reject);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch(() => {
    console.error("DayFlow failed to start: stored task data is invalid or unavailable");
    process.exitCode = 1;
  });
}
