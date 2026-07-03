#!/usr/bin/env node
/**
 * Minimal MCP server implementing the core JSON-RPC transport for the style-integrity tool.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { checkStyleIntegrity } = require('./checkStyleIntegrity');


const TOOL_DEFINITION = {
  name: 'check_style_integrity',
  description:
    'Analyzes CSS/SCSS files and Tailwind-related markup for cascade conflicts, duplicate declarations, specificity issues, and conflicting utilities. ' +
    'The result is a structured report with explanation, suggested fixes, and a next step for the agent, intended for human review before any style change is applied.',
  inputSchema: {
    type: 'object',
    properties: {
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'Absolute or relative file paths to analyze (.css, .scss, .jsx, .tsx, .html, .vue, .js, .ts)',
      },
      projectRoot: {
        type: 'string',
        description: 'A project root directory to analyze recursively for style-related files',
      },
      changedFiles: {
        type: 'boolean',
        description: 'Analyze git changed files in the current repository working tree',
      },
    },
    additionalProperties: false,
  },
};

function send(message) {
  process.stdout.write(JSON.stringify(message) + '\n');
}

function isStyleTarget(target) {
  const ext = path.extname(target).toLowerCase();
  return ['.css', '.scss', '.jsx', '.tsx', '.html', '.vue', '.js', '.ts'].includes(ext);
}

function loadConfig(startDir) {
  // Walk up from startDir looking for .styleintegrityrc
  let dir = path.resolve(startDir);
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, '.styleintegrityrc');
    if (fs.existsSync(candidate)) {
      try { return JSON.parse(fs.readFileSync(candidate, 'utf8')); } catch { return {}; }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return {};
}

function printCliUsage() {
  console.log('Usage: node server.js [--changed] [--fail-on-issues] [--watch] [--projectRoot <dir>] [<file-or-directory>]');
  console.log('  --changed          Analyze git changed files in the current repository');
  console.log('  --fail-on-issues   Exit with code 1 if any issues are found');
  console.log('  --watch            Re-run analysis on file changes (use with file or --projectRoot)');
  console.log('  --projectRoot DIR  Analyze a directory recursively for style files');
  console.log('  <file-or-directory> Analyze a single file or directory by extension');
  console.log('');
  console.log('Config: place a .styleintegrityrc JSON file in your project root.');
  console.log('  { "ignore": ["dist", "*.min.css"], "failOn": ["error", "warning"] }');
}

function runCli(args) {
  if (args.length === 0) {
    printCliUsage();
    return;
  }

  if (args.includes('--help') || args.includes('-h')) {
    printCliUsage();
    return;
  }

  let input;
  const failOnIssues = args.includes('--fail-on-issues');
  const changedFiles = args.includes('--changed');
  const watchMode = args.includes('--watch');
  const config = loadConfig(process.cwd());

  if (changedFiles) {
    input = { changedFiles: true };
  } else if (args.includes('--projectRoot')) {
    const idx = args.indexOf('--projectRoot');
    input = { projectRoot: args[idx + 1] };
  } else {
    const target = args.find(a => !a.startsWith('--'));
    if (!target) { printCliUsage(); return; }
    input = isStyleTarget(target) ? { files: [target] } : { projectRoot: target };
  }

  function runAnalysis() {
    const report = checkStyleIntegrity(input, config);
    console.log(JSON.stringify(report, null, 2));
    if (failOnIssues && !report.clean) process.exitCode = 1;
  }

  runAnalysis();

  if (watchMode) {
    const watchTarget = input.projectRoot || (Array.isArray(input.files) ? path.dirname(input.files[0]) : process.cwd());
    console.error(`[stylesafe] Watching ${watchTarget} for changes...`);
    let debounce;
    fs.watch(watchTarget, { recursive: true }, (_, filename) => {
      if (!filename) return;
      const ext = path.extname(filename).toLowerCase();
      if (!['.css', '.scss', '.jsx', '.tsx', '.html', '.vue', '.js', '.ts'].includes(ext)) return;
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        console.error(`[stylesafe] Change detected in ${filename}, re-analyzing...`);
        runAnalysis();
      }, 150);
    });
  }
}

function handleRequest(req) {
  const { id, method, params } = req;

  if (method === 'initialize') {
    send({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'stylesafe', version: '0.1.0' } } });
    return;
  }

  if (method === 'notifications/initialized') {
    return;
  }

  if (method === 'tools/list') {
    send({ jsonrpc: '2.0', id, result: { tools: [TOOL_DEFINITION] } });
    return;
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params || {};
    if (name !== 'check_style_integrity') {
      send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool: ${name}` } });
      return;
    }
    try {
      const files = (args && args.files) || [];
      const projectRoot = (args && args.projectRoot) || null;
      const changedFiles = args && args.changedFiles;
      const report = checkStyleIntegrity(changedFiles ? { changedFiles } : projectRoot ? { projectRoot } : files);
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }], isError: !report.passed } });
    } catch (err) {
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Error running analysis: ${err.message}` }], isError: true } });
    }
    return;
  }

  if (id !== undefined) {
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    runCli(args);
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  rl.on('line', line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let req;
    try {
      req = JSON.parse(trimmed);
    } catch {
      return;
    }

    handleRequest(req);
  });
}
