import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { validateTaskCollection } from "../validation/task-validation.js";

function parseStoredTasks(text) {
  let document;
  try {
    document = JSON.parse(text);
  } catch (error) {
    throw new Error("Stored task data is not valid JSON", { cause: error });
  }

  if (
    document === null ||
    typeof document !== "object" ||
    Array.isArray(document) ||
    Object.keys(document).length !== 1 ||
    !Object.hasOwn(document, "tasks")
  ) {
    throw new Error("Stored task data has an invalid root structure");
  }

  try {
    validateTaskCollection(document.tasks);
  } catch (error) {
    throw new Error(`Stored task data is invalid: ${error.message}`, { cause: error });
  }

  return document.tasks;
}

async function writeAtomically(filePath, data, renameFile) {
  await mkdir(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  let handle;

  try {
    handle = await open(temporaryPath, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify({ tasks: data }, null, 2)}\n`, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await renameFile(temporaryPath, filePath);
  } catch (error) {
    if (handle) {
      await handle.close();
    }
    try {
      await unlink(temporaryPath);
    } catch (cleanupError) {
      if (cleanupError.code !== "ENOENT") {
        throw new AggregateError([error, cleanupError], "Failed to clean up temporary task data");
      }
    }
    throw error;
  }
}

export function createJsonTaskStore({ filePath, renameFile = rename } = {}) {
  if (typeof filePath !== "string" || filePath.length === 0) {
    throw new TypeError("filePath must be a non-empty string");
  }
  if (typeof renameFile !== "function") {
    throw new TypeError("renameFile must be a function");
  }

  let mutationQueue = Promise.resolve();
  let initialized = false;
  let initialization;

  async function loadTasks() {
    if (!initialized) {
      if (!initialization) {
        initialization = (async () => {
          let text;
          try {
            text = await readFile(filePath, "utf8");
          } catch (error) {
            if (error.code !== "ENOENT") {
              throw error;
            }
            await writeAtomically(filePath, [], renameFile);
            initialized = true;
            return [];
          }

          const tasks = parseStoredTasks(text);
          initialized = true;
          return tasks;
        })();
      }
      try {
        return await initialization;
      } catch (error) {
        initialization = undefined;
        throw error;
      }
    }

    return parseStoredTasks(await readFile(filePath, "utf8"));
  }

  function readTasks() {
    return mutationQueue.then(() => loadTasks());
  }

  function mutateTasks(mutator) {
    if (typeof mutator !== "function") {
      return Promise.reject(new TypeError("mutator must be a function"));
    }

    const operation = mutationQueue.then(async () => {
      const currentTasks = await loadTasks();
      const candidateTasks = await mutator(currentTasks);
      validateTaskCollection(candidateTasks);
      await writeAtomically(filePath, candidateTasks, renameFile);
      return candidateTasks;
    });

    mutationQueue = operation.catch(() => {});
    return operation;
  }

  return { readTasks, mutateTasks };
}
