function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function parseDeclarations(block) {
  const decls = [];
  const parts = block.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const prop = trimmed.slice(0, colonIdx).trim().toLowerCase();
    let value = trimmed.slice(colonIdx + 1).trim();
    const important = /!important\s*$/i.test(value);
    if (important) value = value.replace(/!important\s*$/i, '').trim();
    decls.push({ prop, value, important });
  }
  return decls;
}

function combineSelectors(parentSelector, childSelector) {
  const parent = parentSelector.trim();
  const child = childSelector.trim();
  if (!parent) return [child];
  if (!child) return [parent];
  if (child.startsWith('&')) {
    return [parent + child.slice(1)];
  }
  return [`${parent} ${child}`];
}

function parseStyleBlock(blockText, parentSelectors = [], mediaStack = []) {
  const declarations = [];
  const nestedRules = [];
  let cursor = 0;

  while (cursor < blockText.length) {
    const nextOpen = blockText.indexOf('{', cursor);
    const nextSemi = blockText.indexOf(';', cursor);

    if (nextOpen === -1 && nextSemi === -1) break;

    if (nextOpen !== -1 && (nextSemi === -1 || nextOpen < nextSemi)) {
      const selectorText = blockText.slice(cursor, nextOpen).trim();
      if (selectorText) {
        const closeIdx = findMatchingBrace(blockText, nextOpen);
        const childBlock = blockText.slice(nextOpen + 1, closeIdx);
        const combinedSelectors = parentSelectors.flatMap(parent => combineSelectors(parent, selectorText));
        const childResult = parseStyleBlock(childBlock, combinedSelectors, mediaStack);
        if (childResult.declarations.length > 0) {
          nestedRules.push({
            selectors: combinedSelectors,
            declarations: childResult.declarations,
            mediaContext: mediaStack.length > 0 ? mediaStack.join(' > ') : null,
            raw: blockText.slice(nextOpen, closeIdx + 1),
            start: cursor,
          });
        }
        nestedRules.push(...childResult.nestedRules);
        cursor = closeIdx + 1;
        continue;
      }
    }

    const semicolonIndex = nextSemi === -1 ? blockText.length : nextSemi;
    const segment = blockText.slice(cursor, semicolonIndex).trim();
    if (segment) {
      declarations.push(...parseDeclarations(segment));
    }
    cursor = semicolonIndex + 1;
  }

  return { declarations, nestedRules };
}

function parseCSS(cssText) {
  const css = stripComments(cssText);
  const rules = [];
  let i = 0;
  let mediaStack = [];

  while (i < css.length) {
    while (i < css.length && /\s/.test(css[i])) i++;
    if (i >= css.length) break;

    if (css[i] === '@') {
      const braceIdx = css.indexOf('{', i);
      const semiIdx = css.indexOf(';', i);
      if (braceIdx === -1 || (semiIdx !== -1 && semiIdx < braceIdx)) {
        i = semiIdx === -1 ? css.length : semiIdx + 1;
        continue;
      }
      const atRuleHeader = css.slice(i, braceIdx).trim();
      mediaStack.push(atRuleHeader);
      i = braceIdx + 1;
      continue;
    }

    if (css[i] === '}') {
      if (mediaStack.length > 0) mediaStack.pop();
      i++;
      continue;
    }

    const braceIdx = css.indexOf('{', i);
    if (braceIdx === -1) break;
    const selectorText = css.slice(i, braceIdx).trim();
    const closeIdx = findMatchingBrace(css, braceIdx);
    const declBlock = css.slice(braceIdx + 1, closeIdx);
    const selectors = selectorText.split(',').map(s => s.trim()).filter(Boolean);
    const parsedBlock = parseStyleBlock(declBlock, selectors, mediaStack);

    if (parsedBlock.declarations.length > 0) {
      rules.push({
        selectors,
        declarations: parsedBlock.declarations,
        mediaContext: mediaStack.length > 0 ? mediaStack.join(' > ') : null,
        raw: css.slice(i, closeIdx + 1),
        start: i,
      });
    }

    rules.push(...parsedBlock.nestedRules);
    i = closeIdx + 1;
  }

  return rules;
}

function findMatchingBrace(css, openIdx) {
  let depth = 1;
  let i = openIdx + 1;
  while (i < css.length && depth > 0) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
    i++;
  }
  return i - 1;
}

module.exports = { parseCSS, parseDeclarations };
