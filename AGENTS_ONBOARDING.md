# Agents Onboarding Guide

## Purpose
This document helps a new user understand which agent to use, when to use it, and what input and output to expect in this repository.

This framework supports two main QA workflows:
- application understanding from the live app
- Jira-story-driven testcase creation

## Before You Start
Make sure these basics are ready before using any agent:

- The application URL and credentials are available in [`env/.env.prod`](/d:/AgenticAI/AgenticAI/env/.env.prod).
- Playwright MCP is configured if you plan to use the live-execution agent.
- Jira story files are available in [`Jira_Stories`](/d:/AgenticAI/AgenticAI/Jira_Stories).
- Output folders exist:
  - [`ai_knowledge`](/d:/AgenticAI/AgenticAI/ai_knowledge)
  - [`ai_Knowledge_jira_Testcases`](/d:/AgenticAI/AgenticAI/ai_Knowledge_jira_Testcases)

## Agent Overview

### 1. Application Intelligence Agent
File: [`.github/agents/app-intelligence.agent.md`](/d:/AgenticAI/AgenticAI/.github/agents/app-intelligence.agent.md)

Use this agent when:
- you are working with a new application or module
- you want to understand pages, forms, flows, validations, and dependencies
- you want structured application knowledge before generating test cases

What it does:
- explores the live application
- crawls safe UI paths
- extracts pages, elements, flows, validations, and candidate scenarios
- produces application intelligence JSON

What it does not do:
- it does not generate final test cases
- it does not create automation code

Typical input:
- module name or start URL
- app access through `env/.env.prod`

Typical output:
- module intelligence JSON under [`ai_knowledge/modules`](/d:/AgenticAI/AgenticAI/ai_knowledge/modules)

Use it first when:
- the project is new
- the module is new
- the UI changed significantly

### 2. Jira Story Live Agent
File: [`.github/agents/jira-story-live.agent.md`](/d:/AgenticAI/AgenticAI/.github/agents/jira-story-live.agent.md)

Use this agent when:
- you have a Jira story
- you want to validate it against the live application
- you want execution-backed analysis before testcase generation

What it does:
- reads a Jira story from [`Jira_Stories`](/d:/AgenticAI/AgenticAI/Jira_Stories)
- connects to Playwright MCP
- executes the flow in the live application
- captures real validations, navigation, observed behavior, and blockers
- saves structured analysis JSON

What it does not do:
- it does not generate final test cases directly

Typical input:
- a story file like [`Jira_Stories/AG-2.json`](/d:/AgenticAI/AgenticAI/Jira_Stories/AG-2.json)

Typical output:
- execution-backed story analysis in [`ai_Knowledge_jira_Testcases`](/d:/AgenticAI/AgenticAI/ai_Knowledge_jira_Testcases)

Use it when:
- the story must be checked against the real app
- you want evidence-based scenarios
- you want to detect blockers or mismatches between story and UI

### 3. Jira Story Agent
File: [`.github/agents/jira-story.agent.md`](/d:/AgenticAI/AgenticAI/.github/agents/jira-story.agent.md)

Use this agent when:
- you have a Jira story
- you do not want live app execution
- you want quick, user-readable BDD-style test cases from the story text alone

What it does:
- reads a Jira story from [`Jira_Stories`](/d:/AgenticAI/AgenticAI/Jira_Stories)
- analyzes the story only
- creates BDD-style test cases in markdown
- covers positive, negative, validation, navigation, workflow, and edge scenarios where supported by the story

What it does not do:
- it does not connect to MCP
- it does not use Playwright
- it does not validate against the live app

Typical input:
- a story file like [`Jira_Stories/AG-2.json`](/d:/AgenticAI/AgenticAI/Jira_Stories/AG-2.json)

Typical output:
- readable markdown test cases like [`ai_Knowledge_jira_Testcases/AG-2_testcases.md`](/d:/AgenticAI/AgenticAI/ai_Knowledge_jira_Testcases/AG-2_testcases.md)

Use it when:
- you need fast draft test cases
- the app is not available yet
- you want business-readable BDD scenarios for review

### 4. Test Case Generator Agent
File: [`.github/agents/testcase-generator.agent.md`](/d:/AgenticAI/AgenticAI/.github/agents/testcase-generator.agent.md)

Use this agent when:
- you already have application intelligence JSON
- you want machine-structured test cases from that intelligence

What it does:
- reads structured application intelligence
- converts that intelligence into practical test cases
- produces JSON testcases with priority, steps, and expected results

What it does not do:
- it does not crawl the live app by itself
- it does not read Jira stories directly as its primary source

Typical input:
- an application intelligence JSON file under [`ai_knowledge`](/d:/AgenticAI/AgenticAI/ai_knowledge)

Typical output:
- structured testcase JSON under [`ai_knowledge`](/d:/AgenticAI/AgenticAI/ai_knowledge)

Use it when:
- app intelligence is already available
- you want reusable structured testcase data

## Recommended Workflows

### Workflow A: New Project or New Module
Use this when the application or module is new and you need a baseline understanding.

1. Configure the environment in [`env/.env.prod`](/d:/AgenticAI/AgenticAI/env/.env.prod).
2. Run the Application Intelligence Agent on the module or full app.
3. Review the generated intelligence files.
4. Run the Test Case Generator Agent on the intelligence output.

Use this workflow for:
- new projects
- newly added modules
- large UI changes

### Workflow B: Story-Only Test Design
Use this when you only have a Jira story and want quick BDD cases.

1. Extract or place the Jira story JSON in [`Jira_Stories`](/d:/AgenticAI/AgenticAI/Jira_Stories).
2. Run the Jira Story Agent.
3. Review the generated markdown test cases in [`ai_Knowledge_jira_Testcases`](/d:/AgenticAI/AgenticAI/ai_Knowledge_jira_Testcases).

Use this workflow for:
- early QA planning
- business review
- cases where the app is not accessible yet

### Workflow C: Story Validation Against Live App
Use this when you want the Jira story checked against the real application before testcase generation.

1. Extract or place the Jira story JSON in [`Jira_Stories`](/d:/AgenticAI/AgenticAI/Jira_Stories).
2. Ensure Playwright MCP is available.
3. Run the Jira Story Live Agent.
4. Review the execution-backed story analysis JSON in [`ai_Knowledge_jira_Testcases`](/d:/AgenticAI/AgenticAI/ai_Knowledge_jira_Testcases).
5. Use that output as input for downstream testcase design or review.

Use this workflow for:
- story verification
- UAT support
- identifying story vs UI mismatches

## Which Agent Should I Use?

Use the Application Intelligence Agent if:
- you want to understand the app itself

Use the Jira Story Agent if:
- you want BDD test cases from story text only

Use the Jira Story Live Agent if:
- you want story analysis backed by real execution

Use the Test Case Generator Agent if:
- you already have application intelligence and want structured testcase JSON

## Input and Output Quick Map

Application Intelligence Agent:
- input: app/module access
- output: app intelligence JSON

Jira Story Agent:
- input: Jira story JSON
- output: BDD markdown test cases

Jira Story Live Agent:
- input: Jira story JSON plus live app access
- output: execution-backed story analysis JSON

Test Case Generator Agent:
- input: app intelligence JSON
- output: structured testcase JSON

## Good Practice for New Users

- Start with one small module first instead of the whole app.
- Keep Jira story files one per JSON file.
- Review generated outputs before chaining them into the next step.
- Use the story-only agent when speed matters.
- Use the live agent when accuracy against the real app matters.
- Regenerate app intelligence when major UI behavior changes.

## Example Paths

- Story source: [`Jira_Stories/AG-2.json`](/d:/AgenticAI/AgenticAI/Jira_Stories/AG-2.json)
- Story-only output: [`ai_Knowledge_jira_Testcases/AG-2_testcases.md`](/d:/AgenticAI/AgenticAI/ai_Knowledge_jira_Testcases/AG-2_testcases.md)
- Live execution output: [`ai_Knowledge_jira_Testcases/AG-2.json`](/d:/AgenticAI/AgenticAI/ai_Knowledge_jira_Testcases/AG-2.json)
- App intelligence sample: [`ai_knowledge/modules/Departments/app_intelligence.json`](/d:/AgenticAI/AgenticAI/ai_knowledge/modules/Departments/app_intelligence.json)
- Generated testcase sample: [`ai_knowledge/testcases_Departments.json`](/d:/AgenticAI/AgenticAI/ai_knowledge/testcases_Departments.json)

## Simple Decision Guide

If you only have the story:
- use Jira Story Agent

If you have the story and want live validation:
- use Jira Story Live Agent

If you want deep app understanding first:
- use Application Intelligence Agent

If you already have intelligence and want testcase JSON:
- use Test Case Generator Agent
