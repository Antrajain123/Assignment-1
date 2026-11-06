import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function createTemporaryStore({ initialData } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "dayflow-test-"));
  const filePath = path.join(directory, "tasks.json");

  if (initialData !== undefined) {
    const contents =
      typeof initialData === "string"
        ? initialData
        : `${JSON.stringify(initialData, null, 2)}\n`;
    await writeFile(filePath, contents, { encoding: "utf8", flag: "wx" });
  }

  return {
    directory,
    filePath,
    async cleanup() {
      await rm(directory, { recursive: true, force: true });
    },
  };
}
