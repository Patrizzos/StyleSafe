# stylesafe

An MCP server and CLI that catches CSS cascade conflicts and Tailwind utility clashes before they ship — built for AI coding agents and CI workflows.

## What it does

- Detects duplicate CSS declarations and dead rules from specificity conflicts
- Flags silent style overrides that may be accidental
- Finds conflicting Tailwind utilities (padding, margin, background, shadow, opacity, border, ring, etc.)
- Understands `cn()`, `clsx()`, and `twMerge()` call expressions, not just plain `className` strings
- Returns structured agent-friendly reports with `confidence`, `riskScore`, and `nextStep`

## Quick start

### As a CLI tool

```bash
npm install -g stylesafe
stylesafe src/components/Button.jsx
stylesafe --changed --fail-on-issues
stylesafe --projectRoot src
stylesafe --watch src
```

### As an MCP server

```json
{
  "mcpServers": {
    "stylesafe": {
      "command": "node",
      "args": ["/absolute/path/to/server.js"]
    }
  }
}
```

## Example output

```bash
stylesafe examples/tailwind-conflict.jsx
```

Returns a structured report:

```json
{
  "totalIssues": 5,
  "riskScore": 275,
  "averageRiskScore": 55,
  "riskLevel": "medium",
  "passed": true,
  "clean": false,
  "files": [
    {
      "filename": "examples/tailwind-conflict.jsx",
      "issues": [
        {
          "type": "tailwind-conflict",
          "category": "padding",
          "classes": ["p-4", "px-8"],
          "confidence": "medium",
          "riskScore": 55,
          "nextStep": "Choose one utility from the conflicting set or split the classes by scope.",
          "requiresUserConfirmation": true
        }
      ]
    }
  ]
}
```

`passed: true` means no hard errors. `clean: true` means zero issues of any kind.

## Use cases

- **AI code generation**: Catch style bugs before the agent commits changes
- **PR gate**: Block merged changes that introduce cascade conflicts or utility clashes
- **Agent workflows**: Integrate as a confirmation step in multi-turn coding tasks
- **Style audits**: Run across a project to find existing issues

## CLI options

- `stylesafe <file>` — analyze a single file
- `stylesafe <dir>` — analyze a directory recursively
- `stylesafe --projectRoot <dir>` — same as above
- `stylesafe --changed` — analyze git-changed files (for PR/CI)
- `stylesafe --changed --fail-on-issues` — exit with code 1 if any issues found
- `stylesafe --watch src` — re-run on every file change
- `npm test` — run regression tests

## Config

Place a `.styleintegrityrc` file in your project root:

```json
{
  "ignore": ["dist", "*.min.css"],
  "failOn": ["error", "warning"]
}
```

## GitHub Actions

Add to `.github/workflows/style-check.yml`:

```yaml
name: stylesafe

on:
  pull_request:
  push:
    branches: [main]

jobs:
  stylesafe:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: node server.js --changed --fail-on-issues
```
