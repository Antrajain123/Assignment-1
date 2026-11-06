import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  await readFile(path.join(projectRoot, "package.json"), "utf8"),
);
const generation = process.env.DAYFLOW_EVIDENCE_GENERATION ?? "initial-generation";
const allowedGenerations = new Set(["initial-generation", "final-generation"]);
const startedAt = new Date().toISOString();

if (!allowedGenerations.has(generation)) {
  console.error(
    "DAYFLOW_EVIDENCE_GENERATION must be initial-generation or final-generation.",
  );
  process.exitCode = 2;
} else {
  const gates = [
    { name: "lint", command: "lint" },
    { name: "syntax", command: "node --check on project JavaScript files" },
    { name: "security", command: "security" },
    { name: "tests", command: "test" },
  ];
  const toolVersions = {
    node: runVersion(process.execPath, ["--version"]),
    npm: runVersion(process.platform === "win32" ? "npm.cmd" : "npm", ["--version"]),
    eslintDeclared: packageJson.devDependencies?.eslint ?? null,
  };
  const results = [];

  for (const gate of gates) {
    let result;
    try {
      result =
        gate.name === "syntax"
          ? await runSyntaxChecks()
          : runNpmGate(gate.command);
    } catch (error) {
      result = {
        command: gate.name === "syntax" ? "syntax check" : "npm",
        status: 1,
        signal: null,
        error,
        stdout: "",
        stderr: error.message,
      };
    }
    const stdout = result.stdout ?? "";
    const stderr = result.stderr ?? "";
    const observedExitCode = result.status;
    const testCount =
      gate.name === "tests" ? parseTestCount(stdout, stderr) : null;
    const passed =
      observedExitCode === 0 &&
      !result.error &&
      (gate.name !== "tests" || (testCount !== null && testCount > 0));

    process.stdout.write(`\n=== ${gate.name}: ${passed ? "PASS" : "FAIL"} ===\n`);
    if (stdout) {
      process.stdout.write(stdout);
    }
    if (stderr) {
      process.stderr.write(stderr);
    }
    if (result.error) {
      process.stderr.write(`${result.error.message}\n`);
    }
    if (result.signal) {
      process.stderr.write(`Process terminated by signal: ${result.signal}\n`);
    }
    if (!passed) {
      process.stderr.write(
        `Expected exit code 0; observed ${observedExitCode ?? "no exit code"}.\n`,
      );
      if (gate.name === "tests" && (testCount === null || testCount === 0)) {
        process.stderr.write(
          `Expected at least 1 discovered test; observed ${
            testCount === null ? "no test count" : testCount
          }.\n`,
        );
      }
    }

    results.push({
      gate: gate.name,
      command:
        result.commands ?? [result.command, "run", gate.command],
      expectedExitCode: 0,
      observedExitCode,
      ...(gate.name === "tests"
        ? { expectedMinimumTestCount: 1, observedTestCount: testCount }
        : {}),
      signal: result.signal ?? null,
      passed,
      spawnError: result.error?.message ?? null,
      failureDetails: passed
        ? []
        : [
            ...extractFailureDetails(stdout, stderr, result.error?.message),
            ...(gate.name === "tests" && (testCount === null || testCount === 0)
              ? [
                  `Expected at least 1 discovered test; observed ${
                    testCount === null ? "no test count" : testCount
                  }.`,
                ]
              : []),
            ...(Array.isArray(result.failureDetails)
              ? result.failureDetails.map((failure) => JSON.stringify(failure))
              : []),
          ],
      stdout,
      stderr,
    });
  }

  const validationDirectory = path.join(
    projectRoot,
    "evidence",
    generation,
    "validation",
  );
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const reportPath = path.join(validationDirectory, `validation-${timestamp}.json`);
  const report = {
    startedAt,
    generation,
    toolVersions,
    results,
    overallPassed: results.every((result) => result.passed),
  };

  try {
    await mkdir(validationDirectory, { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    console.log(`\nFull validation diagnostics saved to ${path.relative(projectRoot, reportPath)}`);
  } catch (error) {
    console.error(`Unable to preserve validation diagnostics: ${error.message}`);
    process.exitCode = 1;
  }

  if (!report.overallPassed) {
    console.error("\nValidation failed: one or more gates returned a nonzero result.");
    process.exitCode = 1;
  }
}

function runVersion(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return {
    output: (result.stdout ?? result.stderr ?? "").trim(),
    exitCode: result.status,
    error: result.error?.message ?? null,
  };
}

function runNpmGate(script) {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(command, ["run", script], {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    shell: process.platform === "win32",
  });

  return { ...result, command };
}

async function runSyntaxChecks() {
  const files = [];

  await collectJavaScriptFiles(projectRoot, files);
  files.sort();

  const outputs = files.map((file) => {
    const result = spawnSync(process.execPath, ["--check", file], {
      cwd: projectRoot,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });

    return {
      command: [process.execPath, "--check", path.relative(projectRoot, file)],
      status: result.status,
      signal: result.signal,
      error: result.error,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  });
  const failures = outputs.filter(
    (result) => result.status !== 0 || result.error,
  );

  return {
    commands: outputs.map((result) => result.command),
    status: failures.length === 0 ? 0 : (failures[0].status ?? 1),
    signal: failures[0]?.signal ?? null,
    error: failures[0]?.error ?? null,
    stdout: outputs.map((result) => result.stdout).join(""),
    stderr: outputs
      .map((result, index) => {
        const output = result.stderr || result.error?.message || "";
        return output ? `[${path.relative(projectRoot, files[index])}]\n${output}` : "";
      })
      .filter(Boolean)
      .join("\n"),
    failureDetails: failures.map((result) => ({
      command: result.command,
      exitCode: result.status,
      signal: result.signal ?? null,
      error: result.error?.message ?? null,
      stderr: result.stderr,
    })),
  };
}

async function collectJavaScriptFiles(targetPath, files) {
  if (/\.(?:cjs|js|mjs)$/.test(targetPath)) {
    files.push(targetPath);
    return;
  }

  if (
    [".git", ".github", ".specify", "evidence", "node_modules", "specs"].includes(
      path.basename(targetPath),
    )
  ) {
    return;
  }

  try {
    const entries = await readdir(targetPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(targetPath, entry.name);
      if (entry.isDirectory()) {
        await collectJavaScriptFiles(entryPath, files);
      } else if (/\.(?:cjs|js|mjs)$/.test(entry.name)) {
        files.push(entryPath);
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function parseTestCount(stdout, stderr) {
  const output = `${stdout}\n${stderr}`;
  const match = output.match(/^\s*(?:#\s*|ℹ\s*)?tests\s+(\d+)\s*$/m);
  return match ? Number(match[1]) : null;
}

function extractFailureDetails(stdout, stderr, spawnError) {
  const output = `${stdout}\n${stderr}`;
  const failurePatterns =
    /(?:error|failed|failure|assertion|expected|actual|not ok|✖|×|stack trace|ENOENT|Could not find|Cannot find)/i;
  const matchingLines = output
    .split(/\r?\n/)
    .filter((line) => failurePatterns.test(line))
    .map((line) => line.trim())
    .filter(Boolean);

  if (spawnError) {
    matchingLines.unshift(spawnError);
  }

  return [...new Set(matchingLines)];
}
