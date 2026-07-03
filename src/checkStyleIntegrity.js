const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { analyzeCascade } = require('./cascadeAnalyzer');
const { extractClassStringsFromMarkup, detectTailwindConflicts } = require('./tailwindAnalyzer');

const CSS_EXTENSIONS = new Set(['.css', '.scss']);
const MARKUP_EXTENSIONS = new Set(['.jsx', '.tsx', '.html', '.vue', '.js', '.ts']);

function getConfidence(issue) {
  if (issue.type === 'specificity-override' || issue.type === 'duplicate-in-rule') return 'high';
  if (issue.type === 'tailwind-conflict' || issue.type === 'important-usage') return 'medium';
  return 'medium';
}

function getRiskScore(issue) {
  if (issue.type === 'duplicate-in-rule') return 80;
  if (issue.type === 'specificity-override') return 75;
  if (issue.type === 'important-usage') return 65;
  if (issue.type === 'tailwind-conflict') return 55;
  return 40;
}

function toIssueWithAction(issue, filePath) {
  const explanation = issue.message || 'Style issue detected.';
  const nextStep = issue.type === 'specificity-override'
    ? 'Review the selectors and adjust the weaker rule or increase specificity intentionally.'
    : issue.type === 'duplicate-in-rule'
      ? 'Remove the duplicate declaration or consolidate the values into a single declaration.'
      : issue.type === 'tailwind-conflict'
        ? 'Choose one utility from the conflicting set or split the classes by scope.'
        : 'Review this override and confirm the intended winner before changing the styles.';

  const suggestions = [];
  if (issue.type === 'specificity-override') {
    suggestions.push(`Replace or simplify the lower-specificity rule in ${filePath}`);
    suggestions.push('Make the intended winner more explicit with a more specific selector');
  } else if (issue.type === 'duplicate-in-rule') {
    suggestions.push(`Remove the duplicate property from ${filePath}`);
    suggestions.push('Keep a single canonical declaration for the property');
  } else if (issue.type === 'tailwind-conflict') {
    suggestions.push('Choose a single utility from the conflicting set');
    suggestions.push('Split conflicting utilities into different variant scopes');
  } else {
    suggestions.push('Confirm whether the override is intentional');
    suggestions.push('Refactor the selectors if the override was accidental');
  }

  const recommendedAction = issue.type === 'specificity-override'
    ? 'Review the selector hierarchy before making any change.'
    : issue.type === 'duplicate-in-rule'
      ? 'Remove the duplicate declaration and keep one canonical value.'
      : issue.type === 'tailwind-conflict'
        ? 'Choose one utility or split the classes by variant scope.'
        : 'Review the override and confirm whether it is intentional.';

  return {
    ...issue,
    confidence: getConfidence(issue),
    riskScore: getRiskScore(issue),
    explanation,
    suggestions: suggestions.slice(0, 3),
    nextStep,
    recommendedAction,
    requiresUserConfirmation: true,
  };
}

function collectChangedFiles() {
  try {
    const raw = execSync('git diff --name-only --diff-filter=ACMRTUXB HEAD', { encoding: 'utf8' });
    return raw
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return CSS_EXTENSIONS.has(ext) || MARKUP_EXTENSIONS.has(ext);
      });
  } catch {
    return [];
  }
}

function collectFilesToAnalyze(input) {
  if (Array.isArray(input)) return input.filter(Boolean);
  if (input && typeof input === 'object') {
    if (input.changedFiles) return collectChangedFiles();
    if (Array.isArray(input.files)) return input.files.filter(Boolean);
    if (input.projectRoot) {
      const root = input.projectRoot;
      const results = [];
      const walk = currentPath => {
        if (!fs.existsSync(currentPath)) return;
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;
          if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') continue;
          const fullPath = path.join(currentPath, entry.name);
          if (entry.isDirectory()) {
            walk(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (CSS_EXTENSIONS.has(ext) || MARKUP_EXTENSIONS.has(ext)) results.push(fullPath);
          }
        }
      };
      walk(root);
      return results;
    }
  }
  return [];
}

/**
 * Checks a set of files for style integrity issues. This is the single function the
 * MCP tool calls. Returns a structured report an agent can read and act on directly.
 */
function checkStyleIntegrity(input) {
  const filePaths = collectFilesToAnalyze(input);
  const report = {
    files: [],
    totalIssues: 0,
    riskScore: 0,
    averageRiskScore: 0,
    riskLevel: 'low',
    summary: { error: 0, warning: 0, info: 0, highConfidence: 0, mediumConfidence: 0, lowConfidence: 0 },
    agentGuidance: {
      requiresUserConfirmation: true,
      message: 'Analyze the findings, explain the risk, and ask for permission before applying any fix.',
    },
    overview: {
      recommendedNextAction: 'Review the highest-confidence issues first and ask for confirmation before changing styles.',
    },
  };

  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) {
      report.files.push({ filename: filePath, error: 'File not found' });
      continue;
    }

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) continue;

    const ext = path.extname(filePath).toLowerCase();
    const source = fs.readFileSync(filePath, 'utf8');
    const fileReport = { filename: filePath, issues: [] };

    if (CSS_EXTENSIONS.has(ext)) {
      const result = analyzeCascade(source, filePath);
      fileReport.issues.push(...result.issues.map(issue => toIssueWithAction(issue, filePath)));
    }

    if (MARKUP_EXTENSIONS.has(ext)) {
      const classStrings = extractClassStringsFromMarkup(source);
      for (const cs of classStrings) {
        fileReport.issues.push(...detectTailwindConflicts(cs, cs).map(issue => toIssueWithAction(issue, filePath)));
      }
    }

    for (const issue of fileReport.issues) {
      report.summary[issue.severity] = (report.summary[issue.severity] || 0) + 1;
      if (issue.confidence === 'high') report.summary.highConfidence++;
      if (issue.confidence === 'medium') report.summary.mediumConfidence++;
      if (issue.confidence === 'low') report.summary.lowConfidence++;
      report.totalIssues++;
      report.riskScore += issue.riskScore || 0;
    }
    report.files.push(fileReport);
  }

  report.passed = report.summary.error === 0;
  report.clean = report.totalIssues === 0;
  if (report.totalIssues > 0) {
    report.averageRiskScore = Math.round(report.riskScore / report.totalIssues);
    report.riskLevel = report.averageRiskScore >= 70 ? 'high' : report.averageRiskScore >= 50 ? 'medium' : 'low';
  }
  return report;
}

module.exports = { checkStyleIntegrity };
