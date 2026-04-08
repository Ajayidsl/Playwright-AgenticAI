const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const AGENT_PROMPT_PATH =
  process.env.APP_INTELLIGENCE_AGENT_PROMPT ||
  path.resolve(ROOT_DIR, '.github', 'agents', 'app-intelligence.agent.md');

const moduleArg = process.argv[2];
const DEFAULT_MODULES = ['fields', 'security'];
const modules = moduleArg
  ? moduleArg.split(',').map((moduleName) => moduleName.trim()).filter(Boolean)
  : process.env.APP_INTELLIGENCE_MODULES
  ? JSON.parse(process.env.APP_INTELLIGENCE_MODULES)
  : DEFAULT_MODULES;
const APP_INTELLIGENCE_MODE =
  process.env.APP_INTELLIGENCE_MODE || 'module';

const APP_INTELLIGENCE_FILE = process.env.APP_INTELLIGENCE_FILE
  ? path.resolve(process.env.APP_INTELLIGENCE_FILE)
  : process.env.APP_ELEMENTS_FILE
  ? path.resolve(process.env.APP_ELEMENTS_FILE)
  : getDefaultAppElementsFile();

function getDefaultAppElementsFile() {
  const aiKnowledgeRoot = path.resolve(ROOT_DIR, 'ai_knowledge');
  const safeName = modules
    .map((moduleName) => moduleName.replace(/[^a-zA-Z0-9_-]/g, '_'))
    .join('_');

  if (APP_INTELLIGENCE_MODE === 'module' && safeName) {
    return path.join(aiKnowledgeRoot, 'modules', safeName, 'app_intelligence.json');
  }

  if (APP_INTELLIGENCE_MODE === 'full_app') {
    return path.join(aiKnowledgeRoot, 'full_app', 'app_intelligence.json');
  }

  return path.join(aiKnowledgeRoot, 'app_intelligence.json');
}

const CODEX_SANDBOX = process.env.CODEX_SANDBOX || 'danger-full-access';
const DEFAULT_STAGE_TIMEOUT_MS =
  process.env.CODEX_STAGE_TIMEOUT_MS !== undefined
    ? Number(process.env.CODEX_STAGE_TIMEOUT_MS)
    : 1200000; // 20 minutes for thorough exploration

function ensureDirectory(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeJsonSafe(filePath, data) {
  ensureDirectory(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function loadAppIntelligence() {
  if (!fs.existsSync(APP_INTELLIGENCE_FILE)) {
    return null;
  }

  try {
    const content = fs.readFileSync(APP_INTELLIGENCE_FILE, 'utf-8');
    const json = JSON.parse(content);
    if (!Array.isArray(json.elements)) {
      console.warn(`Expected \`elements\` array in ${APP_INTELLIGENCE_FILE}`);
      return json;
    }
    return json;
  } catch (error) {
    console.error(`Unable to parse ${APP_INTELLIGENCE_FILE}:`, error.message);
    return null;
  }
}

function resolveCodexCommand() {
  if (process.env.CODEX_PATH && fs.existsSync(process.env.CODEX_PATH)) {
    return process.env.CODEX_PATH;
  }

  const userProfile = process.env.USERPROFILE;
  if (!userProfile) {
    return 'codex.exe';
  }

  const extensionsRoot = path.join(userProfile, '.vscode', 'extensions');
  if (!fs.existsSync(extensionsRoot)) {
    return 'codex.exe';
  }

  const bundledCodex = fs
    .readdirSync(extensionsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('openai.chatgpt-'))
    .map((entry) =>
      path.join(extensionsRoot, entry.name, 'bin', 'windows-x86_64', 'codex.exe')
    )
    .find((candidate) => fs.existsSync(candidate));

  return bundledCodex || 'codex.exe';
}

function runCodexAgent() {
  if (!fs.existsSync(AGENT_PROMPT_PATH)) {
    throw new Error(`Agent prompt not found: ${AGENT_PROMPT_PATH}`);
  }

  const agentSpec = fs.readFileSync(AGENT_PROMPT_PATH, 'utf-8');
  const agentInput = {
    task: 'application_intelligence',
    mode: APP_INTELLIGENCE_MODE,
    modules: APP_INTELLIGENCE_MODE === 'module' ? modules : undefined,
    scope: process.env.APP_INTELLIGENCE_SCOPE
      ? JSON.parse(process.env.APP_INTELLIGENCE_SCOPE)
      : undefined,
  };

  const tempInputPath = path.resolve(__dirname, 'agent_input.json');
  writeJsonSafe(tempInputPath, agentInput);

  const executionPrompt = [
    'You are an automation agent running in non-interactive execution mode.',
    'Do not summarize. Do not analyze. Do not explain. Do not ask questions.',
    'Read the JSON payload from APP_INTELLIGENCE_INPUT_PATH and use it as the only input.',
    'Write the final unified application intelligence JSON to APP_INTELLIGENCE_FILE using shell commands.',
    'Do not print the output JSON to stdout.',
    'If APP_INTELLIGENCE_FILE already exists, overwrite it.',
    'If APP_INTELLIGENCE_FILE is not writable, fail loudly and do not continue.',
    'Use the specification below to perform the task and do not summarize it.',
    '',
    'Required output schema:',
    '- mode',
    '- modules',
    '- summary: { total, visited, blocked, coverage, interactionCoverage }',
    '- pages: [ { name, path, category, discoveredFrom } ]',
    '- elements: [ { selector, type, label, page, priority, visited, attempts, status } ]',
    '- actionsPerformed: [ { selector, success, blocked } ]',
    '- flows: [ { from, action, to, status } ]',
    '- analysis: { capabilities, validations, test_scenarios, coverage_gaps, cross_module_dependencies }',
    '',
    'Task:',
    '- Explore the application safely and thoroughly to achieve maximum coverage.',
    '- Prioritize exploring and interacting with high-priority elements (e.g., buttons, forms, inputs) first, then medium, then low-priority (e.g., links, static content).',
    '- Aim for at least 90% coverage before considering the exploration complete. Track progress and continue until this threshold is met or no new elements are discoverable.',
    '- Focus on breadth-first exploration: visit all main pages/sections early, then deepen interactions. Avoid redundant actions on the same elements.',
    '- Stop exploration if coverage hasn\'t increased in the last 10 minutes or reaches 95%. Finalize output immediately upon reaching the target.',
    '- If an element fails to respond after 2 attempts, mark it as blocked and skip to the next unvisited element. Do not retry blocked elements.',
    '- Calculate interactionCoverage as (number of successful actions / (visited + blocked elements)) * 100.',
    '- Extract all accessible elements and flows.',
    '- Produce analysis.capabilities from the observed controls and successful interactions.',
    '- Produce analysis.validations from required fields, blocked mandatory controls, disabled states, visible validation hints, and safe inference from the explored UI.',
    '- Produce analysis.test_scenarios as business-readable scenario ideas derived from elements, actions, flows, and validations.',
    '- Produce analysis.coverage_gaps for anything blocked, intentionally unsubmitted, inaccessible, or only partially verified.',
    '- Produce analysis.cross_module_dependencies for dependencies on divisions, locations, roles, departments, security, or other related modules.',
    '- Keep raw discovery data and derived analysis together in the same output file.',
    '- Track real UI interactions.',
    '- Avoid destructive actions.',
    '',
    'Agent specification:',
    agentSpec,
  ].join('\n');

  const env = {
    ...process.env,
    APP_INTELLIGENCE_INPUT_PATH: tempInputPath,
    APP_INTELLIGENCE_FILE: APP_INTELLIGENCE_FILE,
    APP_ELEMENTS_FILE: APP_INTELLIGENCE_FILE,
  };

  const command = resolveCodexCommand();
  const args = [
    'exec',
    '--skip-git-repo-check',
    '--sandbox',
    CODEX_SANDBOX,
  ];

  console.log('Running agent for maximum coverage:', command, '--exec --sandbox', CODEX_SANDBOX);
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    input: executionPrompt,
    encoding: 'utf-8',
    shell: false,
    env,
    maxBuffer: 20 * 1024 * 1024,
    timeout: DEFAULT_STAGE_TIMEOUT_MS,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
    throw new Error(
      `Agent failed with status ${result.status}: ${output}`
    );
  }

  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

async function run() {
  console.log('Controller mode:', APP_INTELLIGENCE_MODE);
  console.log('Target modules:', modules.join(', '));
  console.log('Output file:', APP_INTELLIGENCE_FILE);
  if (moduleArg) {
    console.log('Running module from CLI:', moduleArg);
  }

  try {
    const result = runCodexAgent();
    const appElements = loadAppIntelligence();

    if (!appElements) {
      throw new Error(`No output file generated at ${APP_INTELLIGENCE_FILE}`);
    }

    console.log('✅ Exploration complete.');
    console.log('Coverage:', appElements.summary?.coverage || 'unknown');
    console.log('Elements found:', appElements.elements?.length || 0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

run();
