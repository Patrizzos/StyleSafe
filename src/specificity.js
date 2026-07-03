/**
 * Computes CSS specificity for a single selector string as [inlineFlag, idCount, classCount, typeCount].
 * Follows the standard algorithm: IDs > classes/attrs/pseudo-classes > elements/pseudo-elements.
 * Combinators (>, +, ~, space) and universal selector (*) don't add weight.
 */

function compareSpecificity(a, b) {
  for (let i = 0; i < 4; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function specificityToString(spec) {
  return `(${spec[0]},${spec[1]},${spec[2]},${spec[3]})`;
}

function calculateSpecificity(selector) {
  let sel = selector.trim();
  let idCount = 0;
  let classCount = 0;
  let typeCount = 0;

  // Strip pseudo-element (counts as type): ::before, ::after, etc. (also legacy single-colon :before/:after)
  const pseudoElements = /::?(before|after|first-line|first-letter|placeholder|selection|marker)\b/gi;
  sel = sel.replace(pseudoElements, () => {
    typeCount++;
    return '';
  });

  // :not(), :is(), :where() — :where() contributes 0, :not()/:is() contribute the specificity of their most specific argument.
  // Simplified: treat :not(...) and :is(...) contents as normal selectors (recurse), :where(...) strip entirely with 0 weight.
  sel = sel.replace(/:where\([^)]*\)/gi, '');
  sel = sel.replace(/:(not|is|has)\(([^)]*)\)/gi, (_, _name, inner) => ` ${inner} `);

  // IDs
  sel = sel.replace(/#[\w-]+/g, () => { idCount++; return ''; });

  // Classes, attribute selectors, pseudo-classes (excluding pseudo-elements already removed)
  sel = sel.replace(/\.[\w-]+/g, () => { classCount++; return ''; });
  sel = sel.replace(/\[[^\]]*\]/g, () => { classCount++; return ''; });
  sel = sel.replace(/:[\w-]+/g, () => { classCount++; return ''; });

  // Remaining type selectors (element names) and universal selector
  const typeMatches = sel.match(/(^|[\s>+~])([a-zA-Z][\w-]*)/g);
  if (typeMatches) {
    for (const m of typeMatches) {
      const tag = m.replace(/^[\s>+~]+/, '');
      if (tag && tag !== '*') typeCount++;
    }
  }

  return [0, idCount, classCount, typeCount];
}

module.exports = { calculateSpecificity, compareSpecificity, specificityToString };
