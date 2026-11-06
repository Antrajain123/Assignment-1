import { resolve } from "node:path";

export function loadConfig(environment = process.env) {
  const portValue = environment.PORT ?? "3000";
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new TypeError("PORT must be an integer between 0 and 65535");
  }

  const configuredDataFile = environment.DAYFLOW_DATA_FILE ?? "data/tasks.json";
  if (configuredDataFile.trim().length === 0) {
    throw new TypeError("DAYFLOW_DATA_FILE must be a non-empty path");
  }

  return Object.freeze({
    port,
    host: "127.0.0.1",
    dataFilePath: resolve(configuredDataFile),
  });
}
