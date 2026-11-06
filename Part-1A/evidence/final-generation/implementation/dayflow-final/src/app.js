import express from "express";
import { loadConfig } from "./config.js";
import { ApiError, errorHandler } from "./errors/api-error.js";
import { createJsonTaskStore } from "./persistence/json-task-store.js";
import { createTasksRouter } from "./routes/tasks.js";
import { createTaskService } from "./services/task-service.js";

export function createApp({ config = loadConfig(), store, createId, now } = {}) {
  const taskStore = store ?? createJsonTaskStore({ filePath: config.dataFilePath });
  const taskService = createTaskService({ store: taskStore, createId, now });
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: 1_048_576, strict: true }));
  app.use("/tasks", createTasksRouter(taskService));
  app.use((_request, _response, next) => {
    next(new ApiError(404, "TASK_NOT_FOUND", "Task not found"));
  });
  app.use(errorHandler);

  app.locals.taskStore = taskStore;
  app.locals.taskService = taskService;
  return app;
}
