import { Router } from "express";
import { TaskValidationError } from "../validation/task-validation.js";

function parseListOptions(request) {
  const searchParams = new URL(request.originalUrl, "http://localhost").searchParams;
  for (const name of searchParams.keys()) {
    if (name !== "tag" && name !== "sort") {
      throw new TaskValidationError(`Unsupported query parameter: ${name}`);
    }
  }

  for (const name of ["tag", "sort"]) {
    if (searchParams.getAll(name).length > 1) {
      throw new TaskValidationError(`${name} may be specified only once`);
    }
  }

  const tag = searchParams.get("tag");
  const sort = searchParams.get("sort");
  if (tag === "") {
    throw new TaskValidationError("tag must be a non-empty string");
  }
  if (sort !== null && sort !== "priority") {
    throw new TaskValidationError("sort must be priority when specified");
  }

  return {
    ...(tag === null ? {} : { tag }),
    ...(sort === null ? {} : { sort }),
  };
}

export function createTasksRouter(service) {
  const router = Router();

  router.post("/", async (request, response) => {
    const task = await service.createTask(request.body);
    response.status(201).json({ data: task });
  });

  router.get("/", async (request, response) => {
    const tasks = await service.listTasks(parseListOptions(request));
    response.status(200).json({ data: tasks });
  });

  router.get("/:id", async (request, response) => {
    const task = await service.getTask(request.params.id);
    response.status(200).json({ data: task });
  });

  router.patch("/:id/status", async (request, response) => {
    const task = await service.updateTaskStatus(request.params.id, request.body);
    response.status(200).json({ data: task });
  });

  router.patch("/:id", async (request, response) => {
    const task = await service.updateTask(request.params.id, request.body);
    response.status(200).json({ data: task });
  });

  router.delete("/:id", async (request, response) => {
    const result = await service.deleteTask(request.params.id);
    response.status(200).json({ data: result });
  });

  return router;
}
