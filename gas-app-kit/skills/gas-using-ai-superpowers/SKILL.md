---
name: gas-using-ai-superpowers
description: Meta-skill: establishes how to find and use skills. Use at the start of every conversation to ensure skills are invoked before any response or action.
---

# Using GAS App Kit Superpowers

**Read this skill before anything else in a conversation.**

## The Rule

**Invoke relevant skills BEFORE any response or action — even for questions.**

If there is even a 1% chance a skill applies, invoke it first. Skills tell you HOW to approach the task. Without invoking skills, you are working blind.

## Red Flags — Stop and check for a skill

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. |
| "I can answer this quickly" | Invoke the skill first, then answer. |
| "I remember this skill" | Skills evolve. Invoke the current version. |
| "This feels productive" | Undisciplined action wastes time. |

## Available Skills

| Skill | When to use |
|-------|-------------|
| **gas-start** | User wants to create, plan, or start any new app |
| **gas-setup-environment** | Installing tools, auth errors, Node.js issues |
| **gas-init-project** | Setting up project files, cloning template, linking to GAS |
| **gas-push** | Build and deploy to Google Apps Script |
| **gas-pull** | Sync/download from Google Apps Script |
| **gas-run-project** | Local development server |
| **gas-frontend-patterns** | React, hooks, state, forms, API calls |
| **gas-ant-design** | UI components, layout, design, Ant Design |
| **gas-typescript-pro** | TypeScript, types, interfaces, strict mode |
| **gas-sheet-db** | Saving data, spreadsheet as database, tables, records |
| **gas-readme-standard** | Creating or normalizing the project README before git |
| **forja-debt-tracking** | Marking technical debt / TODO / FIXME / HACK in code |

## Skill Priority

1. **Process skills first**: gas-start, gas-setup-environment (determine HOW to approach)
2. **Domain skills second**: gas-ant-design, gas-frontend-patterns (guide execution)

"I want to build X" → gas-start first, then domain skills.
"Fix this bug" → gas-setup-environment if env issue, else domain skill.

## After reading this skill

Proceed to handle the user's request by invoking the most relevant skill above.
