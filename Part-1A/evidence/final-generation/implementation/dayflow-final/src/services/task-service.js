import { randomUUID } from "node:crypto";
import { ApiError } from "../errors/api-error.js";
import {
  TaskValidationError,
  validateCreateTask,
  validatePersistedTask,
  validateStatusUpdate,
  validateUpdateTask,
} from "../validation/task-validation.js";

const PRIORITY_RANK = new Map([
  ["High", 0],
  ["Medium", 1],
  ["Low", 2],
]);
const ALLOWED_STATUS_TRANSITIONS = new Set([
  "Pending:InProgress",
  "InProgress:Completed",
  "Completed:InProgress",
]);

function compareStrings(left, right) {
  const leftPoints = Array.from(left, (character) => character.codePointAt(0));
  const rightPoints = Array.from(right, (character) => character.codePointAt(0));
  const sharedLength = Math.min(leftPoints.length, rightPoints.length);

  for (let index = 0; index < sharedLength; index += 1) {
    if (leftPoints[index] !== rightPoints[index]) {
      return leftPoints[index] - rightPoints[index];
    }
  }

  return leftPoints.length - rightPoints.length;
}

function validateListOptions({ tag, sort } = {}) {
  if (tag !== undefined && (typeof tag !== "string" || tag.length === 0)) {
    throw new TaskValidationError("tag must be a non-empty string");
  }
  if (sort !== undefined && sort !== "priority") {
    throw new TaskValidationError("sort must be priority when specified");
  }

  return { tag, sort };
}

export function createTaskService({
  store,
  createId = randomUUID,
  now = () => new Date().toISOString(),
} = {}) {
  if (!store || typeof store.readTasks !== "function" || typeof store.mutateTasks !== "function") {
    throw new TypeError("store must provide readTasks and mutateTasks functions");
  }
  if (typeof createId !== "function" || typeof now !== "function") {
    throw new TypeError("createId and now must be functions");
  }

  async function createTask(input) {
    const values = validateCreateTask(input);
    const timestamp = now();
    const task = {
      id: createId(),
      ...values,
      status: "Pending",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    validatePersistedTask(task);

    await store.mutateTasks((tasks) => [...tasks, task]);
    return task;
  }

  async function listTasks(options) {
    const { tag, sort } = validateListOptions(options);
    let tasks = await store.readTasks();

    if (tag !== undefined) {
      const normalizedTag = tag.toLocaleLowerCase("en-US");
      tasks = tasks.filter((task) =>
        task.tags.some((taskTag) => taskTag.toLocaleLowerCase("en-US") === normalizedTag),
      );
    }

    if (sort === "priority") {
      tasks = [...tasks].sort(
        (left, right) =>
          PRIORITY_RANK.get(left.priority) - PRIORITY_RANK.get(right.priority) ||
          compareStrings(left.createdAt, right.createdAt) ||
          compareStrings(left.id, right.id),
      );
    }

    return tasks;
  }

  async function getTask(id) {
    const tasks = await store.readTasks();
    const task = tasks.find((candidate) => candidate.id === id);
    if (!task) {
      throw new ApiError(404, "TASK_NOT_FOUND", "Task not found");
    }

    return task;
  }

  async function updateTask(id, input) {
    const changes = validateUpdateTask(input);
    let updatedTask;

    await store.mutateTasks((tasks) => {
      const taskIndex = tasks.findIndex((candidate) => candidate.id === id);
      if (taskIndex === -1) {
        throw new ApiError(404, "TASK_NOT_FOUND", "Task not found");
      }

      const candidate = {
        ...tasks[taskIndex],
        ...changes,
        updatedAt: now(),
      };
      validatePersistedTask(candidate);
      updatedTask = candidate;

      return tasks.map((task, index) => (index === taskIndex ? candidate : task));
    });

    return updatedTask;
  }

  async function deleteTask(id) {
    let deletedTaskId;

    await store.mutateTasks((tasks) => {
      const taskIndex = tasks.findIndex((candidate) => candidate.id === id);
      if (taskIndex === -1) {
        throw new ApiError(404, "TASK_NOT_FOUND", "Task not found");
      }

      deletedTaskId = tasks[taskIndex].id;
      return tasks.filter((_task, index) => index !== taskIndex);
    });

    return { id: deletedTaskId, deleted: true };
  }

  async function updateTaskStatus(id, input) {
    const { status } = validateStatusUpdate(input);
    let updatedTask;

    await store.mutateTasks((tasks) => {
      const taskIndex = tasks.findIndex((candidate) => candidate.id === id);
      if (taskIndex === -1) {
        throw new ApiError(404, "TASK_NOT_FOUND", "Task not found");
      }

      const currentTask = tasks[taskIndex];
      if (!ALLOWED_STATUS_TRANSITIONS.has(`${currentTask.status}:${status}`)) {
        throw new ApiError(
          409,
          "INVALID_STATUS_TRANSITION",
          `Transition from ${currentTask.status} to ${status} is not allowed`,
        );
      }

      const candidate = {
        ...currentTask,
        status,
        updatedAt: now(),
      };
      validatePersistedTask(candidate);
      updatedTask = candidate;

      return tasks.map((task, index) => (index === taskIndex ? candidate : task));
    });

    return updatedTask;
  }

  return {
    createTask,
    listTasks,
    getTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
  };
}
