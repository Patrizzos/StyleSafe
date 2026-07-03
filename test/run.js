const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { checkStyleIntegrity } = require('../src/checkStyleIntegrity');
const { detectTailwindConflicts } = require('../src/tailwindAnalyzer');

function run() {
  const fixturePath = path.join(__dirname, 'fixtures', 'buggy.css');
  const srcServerPath = path.join(__dirname, '..', 'src', 'server.js');
  const report = checkStyleIntegrity([fixturePath]);

  assert.ok(fs.existsSync(srcServerPath), 'expected src/server.js to exist');

  assert.ok(report.files.length > 0, 'expected one analyzed file');
  assert.ok(report.totalIssues >= 1, 'expected at least one issue');
  assert.ok(report.summary.error >= 1, 'expected at least one error-level issue');
  assert.ok(report.passed === false, 'expected report to fail for buggy fixture');
  assert.ok(report.clean === false, 'expected report.clean to be false when issues exist');
  assert.ok(report.agentGuidance && report.agentGuidance.requiresUserConfirmation === true, 'expected agent guidance to require confirmation');
  assert.ok(report.overview && report.overview.recommendedNextAction, 'expected an overview recommendation');

  const firstIssue = report.files[0].issues[0];
  assert.ok(firstIssue.explanation && firstIssue.explanation.length > 0, 'expected each issue to include an explanation');
  assert.ok(Array.isArray(firstIssue.suggestions) && firstIssue.suggestions.length <= 3, 'expected at most three suggestions per issue');
  assert.ok(firstIssue.nextStep && firstIssue.nextStep.length > 0, 'expected each issue to include a next step');
  assert.ok(firstIssue.recommendedAction && firstIssue.recommendedAction.length > 0, 'expected a recommended action');
  assert.ok(firstIssue.confidence && ['high', 'medium', 'low'].includes(firstIssue.confidence), 'expected a confidence level');

  const projectRootReport = checkStyleIntegrity({ projectRoot: path.join(__dirname, 'fixtures') });
  assert.ok(projectRootReport.files.some(file => file.filename.endsWith('buggy.css')), 'expected project-root analysis to find fixture files');

  const objectFilesReport = checkStyleIntegrity({ files: [path.join(__dirname, 'fixtures', 'buggy.css')] });
  assert.ok(objectFilesReport.files.length === 1, 'expected object files input to work');

  const nestedReport = checkStyleIntegrity([path.join(__dirname, 'fixtures', 'nested.scss')]);
  assert.ok(nestedReport.files[0].issues.some(issue => issue.type === 'duplicate-in-rule' || issue.type === 'specificity-override'), 'expected nested SCSS fixture to produce a style issue');

  const paddingConflicts = detectTailwindConflicts('p-4 px-8', 'padding regression');
  assert.ok(paddingConflicts.some(issue => issue.category === 'padding'), 'expected overlapping padding utilities to be detected');

  const arbitraryValueConflicts = detectTailwindConflicts('hover:bg-[#123456] hover:bg-red-500', 'arbitrary values');
  assert.ok(arbitraryValueConflicts.some(issue => issue.category === 'background-color'), 'expected arbitrary-value background utilities to be detected');

  const shadowConflicts = detectTailwindConflicts('shadow-sm shadow-lg', 'shadow regression');
  assert.ok(shadowConflicts.some(issue => issue.category === 'shadow'), 'expected conflicting shadow utilities to be detected');

  const opacityConflicts = detectTailwindConflicts('opacity-50 opacity-100', 'opacity regression');
  assert.ok(opacityConflicts.some(issue => issue.category === 'opacity'), 'expected conflicting opacity utilities to be detected');

  const responsiveConflicts = detectTailwindConflicts('sm:flex md:flex', 'responsive variants');
  assert.ok(responsiveConflicts.length === 0, 'expected responsive variants to remain in separate scopes');

  console.log('stylesafe regression checks passed');
}

run();
