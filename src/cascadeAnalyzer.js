const { parseCSS } = require('./cssParser');
const { calculateSpecificity, compareSpecificity, specificityToString } = require('./specificity');

function extractTokens(selector) {
  const compound = selector.trim().split(/\s+/).pop(); // rightmost compound selector
  const tokens = compound.match(/[.#]?[\w-]+/g) || [];
  return new Set(tokens);
}

function tokensOverlap(setA, setB) {
  const [small, large] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
  for (const t of small) {
    if (!large.has(t)) return false;
  }
  return small.size > 0;
}

function flattenRules(rules) {
  const flat = [];
  rules.forEach((rule, ruleIdx) => {
    rule.selectors.forEach(selector => {
      flat.push({
        selector,
        declarations: rule.declarations,
        mediaContext: rule.mediaContext,
        sourceOrder: ruleIdx,
        specificity: calculateSpecificity(selector),
      });
    });
  });
  return flat;
}

function analyzeCascade(cssText, filename = '<input>') {
  const rules = parseCSS(cssText);
  const flat = flattenRules(rules);
  const issues = [];

  for (const rule of rules) {
    const seen = new Map();
    for (const decl of rule.declarations) {
      if (seen.has(decl.prop) && !decl.important) {
        issues.push({
          type: 'duplicate-in-rule',
          severity: 'warning',
          selector: rule.selectors.join(', '),
          prop: decl.prop,
          message: `Property "${decl.prop}" is declared more than once in the same rule. Only the last value ("${decl.value}") takes effect; earlier value is dead code.`,
        });
      }
      seen.set(decl.prop, decl.value);
    }
  }

  for (let i = 0; i < flat.length; i++) {
    for (let j = i + 1; j < flat.length; j++) {
      const a = flat[i];
      const b = flat[j];
      if (a.mediaContext !== b.mediaContext) continue; // different media contexts, skip (not directly comparable)
      const tokensA = extractTokens(a.selector);
      const tokensB = extractTokens(b.selector);
      if (!tokensOverlap(tokensA, tokensB)) continue;

      const aProps = new Map(a.declarations.map(d => [d.prop, d]));
      const bProps = new Map(b.declarations.map(d => [d.prop, d]));

      for (const [prop, declB] of bProps) {
        if (!aProps.has(prop)) continue;
        const declA = aProps.get(prop);
        if (declA.value === declB.value) continue; // not actually conflicting in effect

        const cmp = compareSpecificity(b.specificity, a.specificity);
        const bWinsBySource = b.sourceOrder > a.sourceOrder;

        if (cmp < 0 && bWinsBySource === false) {
        } else if (cmp < 0 && !declB.important && declA.important !== true) {
          issues.push({
            type: 'specificity-override',
            severity: 'error',
            prop,
            message: `"${b.selector}" sets ${prop}: ${declB.value}, but it can never apply because "${a.selector}" (specificity ${specificityToString(a.specificity)} vs ${specificityToString(b.specificity)}) sets the same property and wins regardless of source order.`,
            losingSelector: b.selector,
            winningSelector: a.selector,
          });
        } else if (b.sourceOrder > a.sourceOrder && cmp >= 0) {
          issues.push({
            type: 'silent-override',
            severity: 'info',
            prop,
            message: `"${b.selector}" (later in source) overrides "${a.selector}"'s ${prop}: ${declA.value} → ${declB.value}. Confirm this is intentional.`,
            losingSelector: a.selector,
            winningSelector: b.selector,
          });
        }
      }
    }
  }

  const importantCount = flat.reduce(
    (sum, r) => sum + r.declarations.filter(d => d.important).length,
    0
  );
  if (importantCount > 0) {
    issues.push({
      type: 'important-usage',
      severity: importantCount > 3 ? 'warning' : 'info',
      message: `${importantCount} use(s) of !important found. Each one raises the bar for any future rule trying to override it intentionally.`,
    });
  }

  return {
    filename,
    ruleCount: rules.length,
    issues,
    summary: summarize(issues),
  };
}

function summarize(issues) {
  const counts = { error: 0, warning: 0, info: 0 };
  for (const issue of issues) counts[issue.severity] = (counts[issue.severity] || 0) + 1;
  return counts;
}

module.exports = { analyzeCascade };
