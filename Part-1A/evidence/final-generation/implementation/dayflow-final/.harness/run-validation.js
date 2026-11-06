import { spawnSync } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npm, ["run", "validate"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(`Unable to start the DayFlow validation harness: ${result.error.message}`);
  process.exitCode = 1;
} else if (result.signal) {
  console.error(`DayFlow validation harness stopped by signal ${result.signal}.`);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
