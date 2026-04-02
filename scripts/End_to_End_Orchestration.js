const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const AI_DIR = path.join("ai_knowledge", "ai_Knowledge_Admin");
const LOG_DIR = path.join(AI_DIR, "logs");
const LOCK_FILE = path.join(AI_DIR, "orchestration.lock.json");
const GENERATED_SPEC_DIR = path.join("tests", "generated", "admin");
const EXECUTION_ARTIFACT_DIRS = [
  "test-results",
  "allure-results",
  "blob-reports",
  "playwright-report",
  "playwright-report-fix-verification",
];
const OUTPUTS = {
  appGraph: path.join(AI_DIR, "app_graph.json"),
  appAnalysis: path.join(AI_DIR, "app_analysis_admin.json"),
  testcases: path.join(AI_DIR, "testcases_admin.json"),
  generatedSpecs: path.join(AI_DIR, "generated_specs_admin.json"),
  execution: path.join(AI_DIR, "test_execution_admin.json"),
  failures: path.join(AI_DIR, "failure_reports.json"),
  bugs: path.join(AI_DIR, "bug_reports.json"),
  affected: path.join(AI_DIR, "affected_files.json"),
  repaired: path.join(AI_DIR, "repaired_files.json"),
  repairSummary: path.join(AI_DIR, "repair_summary.json"),
};
const STAGE_OUTPUT_WAIT_MS = 20 * 1000;
const CODEX_SANDBOX = process.env.CODEX_SANDBOX || "danger-full-access";
const DEFAULT_STAGE_TIMEOUT_MS = Number(process.env.CODEX_STAGE_TIMEOUT_MS || 0);

const STAGES = {
  crawler: {
    name: "Application Crawler Agent",
    output: OUTPUTS.appGraph,
    prompt:
      "@Application Crawler Agent crawl the application using admin credentials, discover reachable pages, and store the result in ai_knowledge/ai_Knowledge_Admin/app_graph.json",
  },
  analyzer: {
    name: "Application Analyzer",
    output: OUTPUTS.appAnalysis,
    prompt:
      "@Application Analyzer read ai_knowledge/ai_Knowledge_Admin/app_graph.json, analyze all discovered admin pages, and store the result in ai_knowledge/ai_Knowledge_Admin/app_analysis_admin.json",
  },
  testcases: {
    name: "Test Case Generator Agent",
    output: OUTPUTS.testcases,
    prompt:
      "@Test Case Generator Agent read ai_knowledge/ai_Knowledge_Admin/app_analysis_admin.json and generate at most 10 high-priority structured QA test cases for a short demo run in ai_knowledge/ai_Knowledge_Admin/testcases_admin.json",
  },
  codegen: {
    name: "Playwright Code Generator",
    output: OUTPUTS.generatedSpecs,
    prompt:
      "@Playwright Code Generator read ai_knowledge/ai_Knowledge_Admin/testcases_admin.json, generate Playwright specs for at most 10 selected high-priority demo test cases using the existing Page Objects and pageObjectManager.spec.js framework, store specs under tests/generated/admin, and save ai_knowledge/ai_Knowledge_Admin/generated_specs_admin.json",
  },
  execute: {
    name: "Playwright Test Execution Agent",
    output: OUTPUTS.execution,
    prompt:
      "@Playwright Test Execution Agent read ai_knowledge/ai_Knowledge_Admin/generated_specs_admin.json, execute only the generated specs in headed mode with 4 workers, and save ai_knowledge/ai_Knowledge_Admin/test_execution_admin.json",
  },
  failure: {
    name: "Playwright Failure Analyzer",
    output: OUTPUTS.failures,
    prompt:
      "@Playwright Failure Analyzer analyze failures from test-results and allure-results, store the structured report in ai_knowledge/ai_Knowledge_Admin/failure_reports.json, repair locator-related or automation-script issues when supported by evidence by writing ai_knowledge/ai_Knowledge_Admin/affected_files.json, ai_knowledge/ai_Knowledge_Admin/repaired_files.json, and ai_knowledge/ai_Knowledge_Admin/repair_summary.json, and generate ai_knowledge/ai_Knowledge_Admin/bug_reports.json for genuine application defects",
  },
  repair: {
    name: "Playwright Failure Analyzer",
    output: null,
    prompt:
      "@Playwright Failure Analyzer read ai_knowledge/ai_Knowledge_Admin/failure_reports.json, repair locator-related or automation-script failures when supported by evidence, write ai_knowledge/ai_Knowledge_Admin/affected_files.json, ai_knowledge/ai_Knowledge_Admin/repaired_files.json, and ai_knowledge/ai_Knowledge_Admin/repair_summary.json, and generate ai_knowledge/ai_Knowledge_Admin/bug_reports.json for genuine application defects when a code fix should not be applied",
  },
};

function logMessage(message) {
  console.log(message);
}

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function removeDirectoryIfExists(dirPath) {
  if (dirPath && fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

function removeIfExists(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForFile(filePath, timeoutMs = STAGE_OUTPUT_WAIT_MS) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (fs.existsSync(filePath)) {
      return true;
    }
    await sleep(1000);
  }
  return false;
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function hasExecutionFailures(report) {
  return !report || Number(report.failed || 0) > 0;
}

function toArray(data) {
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data?.reports)) {
    return data.reports;
  }
  if (Array.isArray(data?.failures)) {
    return data.failures;
  }
  return data ? [data] : [];
}

function resolveCodexCommand() {
  if (process.env.CODEX_PATH && fs.existsSync(process.env.CODEX_PATH)) {
    return process.env.CODEX_PATH;
  }

  const userProfile = process.env.USERPROFILE;
  if (!userProfile) {
    return "codex.exe";
  }

  const extensionsRoot = path.join(userProfile, ".vscode", "extensions");
  if (!fs.existsSync(extensionsRoot)) {
    return "codex.exe";
  }

  const bundledCodex = fs
    .readdirSync(extensionsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("openai.chatgpt-"))
    .map((entry) =>
      path.join(extensionsRoot, entry.name, "bin", "windows-x86_64", "codex.exe")
    )
    .find((candidate) => fs.existsSync(candidate));

  return bundledCodex || "codex.exe";
}

function stageLogPath(stage) {
  const fileSafeStageName = stage.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return path.join(LOG_DIR, `${fileSafeStageName}.log`);
}

function writeStageLog(stage, result) {
  ensureDirectory(LOG_DIR);
  const lines = [
    `stage=${stage.name}`,
    `started_at=${new Date().toISOString()}`,
    `sandbox=${CODEX_SANDBOX}`,
    `status=${result.status}`,
  ];

  if (typeof result.signal !== "undefined" && result.signal !== null) {
    lines.push(`signal=${result.signal}`);
  }

  lines.push("", "stdout:", result.stdout || "", "", "stderr:", result.stderr || "");
  fs.writeFileSync(stageLogPath(stage), lines.join("\n"), "utf-8");
}

function processExists(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireRunLock() {
  ensureDirectory(AI_DIR);

  if (fs.existsSync(LOCK_FILE)) {
    const existingLock = readJsonSafe(LOCK_FILE);
    if (existingLock?.pid && processExists(existingLock.pid)) {
      throw new Error(
        `Another orchestration run is already active (pid ${existingLock.pid}). Remove ${LOCK_FILE} only if that run is no longer valid.`
      );
    }

    removeIfExists(LOCK_FILE);
  }

  fs.writeFileSync(
    LOCK_FILE,
    JSON.stringify(
      {
        pid: process.pid,
        startedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf-8"
  );
}

function releaseRunLock() {
  const existingLock = readJsonSafe(LOCK_FILE);
  if (!existingLock || existingLock.pid === process.pid) {
    removeIfExists(LOCK_FILE);
  }
}

function runAgent(stage) {
  logMessage(`Running ${stage.name}...`);
  const result = spawnSync(
    resolveCodexCommand(),
    [
      "exec",
      "--skip-git-repo-check",
      "--sandbox",
      CODEX_SANDBOX,
      stage.prompt,
    ],
    {
      cwd: process.cwd(),
      encoding: "utf-8",
      shell: false,
      maxBuffer: 20 * 1024 * 1024,
      timeout: DEFAULT_STAGE_TIMEOUT_MS > 0 ? DEFAULT_STAGE_TIMEOUT_MS : undefined,
    }
  );
  writeStageLog(stage, result);

  if (result.error) {
    throw new Error(
      `${stage.name} failed to start: ${result.error.message}. See ${stageLogPath(stage)}.`
    );
  }

  if (result.status !== 0) {
    const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
    throw new Error(
      output
        ? `${stage.name} failed.\n${output}\nSee ${stageLogPath(stage)}.`
        : `${stage.name} failed. See ${stageLogPath(stage)}.`
    );
  }
}

async function runStage(stage) {
  runAgent(stage);

  if (!stage.output) {
    return;
  }

  const fileReady = await waitForFile(stage.output);
  if (!fileReady) {
    throw new Error(`${stage.name} did not create expected output: ${stage.output}`);
  }

  logMessage(`${stage.name} completed.`);
}

function clearFiles(filePaths) {
  filePaths.forEach(removeIfExists);
}

function resetGeneratedSpecs() {
  removeDirectoryIfExists(GENERATED_SPEC_DIR);
}

function resetExecutionArtifacts() {
  EXECUTION_ARTIFACT_DIRS.forEach(removeDirectoryIfExists);
}

function ensureFailureArtifactsExist() {
  const hasArtifacts =
    fs.existsSync("test-results") || fs.existsSync("allure-results");
  if (!hasArtifacts) {
    throw new Error(
      "Failure analysis requires test-results/ or allure-results/. Run execution first."
    );
  }
}

async function runFailureStage() {
  ensureFailureArtifactsExist();
  clearFiles([
    OUTPUTS.failures,
    OUTPUTS.bugs,
    OUTPUTS.affected,
    OUTPUTS.repaired,
    OUTPUTS.repairSummary,
  ]);
  await runStage(STAGES.failure);
}

async function runRepairStage() {
  clearFiles([OUTPUTS.bugs, OUTPUTS.affected, OUTPUTS.repaired, OUTPUTS.repairSummary]);
  await runStage(STAGES.repair);
}

async function runFullFlow() {
  clearFiles(Object.values(OUTPUTS));
  resetGeneratedSpecs();
  resetExecutionArtifacts();

  await runStage(STAGES.crawler);
  await runStage(STAGES.analyzer);
  await runStage(STAGES.testcases);
  await runStage(STAGES.codegen);
  await runStage(STAGES.execute);

  const executionReport = readJsonSafe(OUTPUTS.execution);
  if (!hasExecutionFailures(executionReport)) {
    logMessage("Playwright execution completed with no failed tests.");
    process.exitCode = 0;
    return;
  }

  await runFailureStage();

  if (fs.existsSync(OUTPUTS.repaired)) {
    logMessage("Repair artifacts created. Re-running generated Playwright specs in headed mode...");
    await runStage(STAGES.execute);

    const verificationReport = readJsonSafe(OUTPUTS.execution);
    if (!hasExecutionFailures(verificationReport)) {
      logMessage("Generated Playwright specs passed after repair.");
      process.exitCode = 0;
      return;
    }

    logMessage("Generated Playwright specs still have failures after repair.");
    process.exitCode = 1;
    return;
  }

  if (fs.existsSync(OUTPUTS.bugs)) {
    logMessage("Failure analysis completed and application bug report(s) were generated.");
  } else {
    logMessage("Failure analysis completed and no automatic repair was produced.");
  }

  process.exitCode = 1;
}

async function main() {
  ensureDirectory(AI_DIR);
  acquireRunLock();

  try {
    await runFullFlow();
  } finally {
    releaseRunLock();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("End-to-end orchestration failed:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { main };
