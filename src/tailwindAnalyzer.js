/**
 * Detects conflicting Tailwind utility classes within the same class list —
 * e.g. "flex hidden" (both control display), "p-4 p-8" (both control all-side padding),
 * "text-left text-right" (both control text-align).
 *
 * This is a deliberately curated table, not a full Tailwind config parser. It covers the
 * utility families that are most commonly involved in agent-introduced bugs: layout/display,
 * spacing, sizing, typography, flex/grid alignment, color. Extend CATEGORIES as needed.
 */

// Each utility definition includes the CSS property set it writes. This allows the
// analyzer to detect real Tailwind conflicts such as p-4 vs px-8 while allowing
// non-conflicting combos like px-3 and py-1.
const UTILITY_DEFINITIONS = [
  { name: 'display', pattern: /^(block|inline-block|inline|flex|inline-flex|grid|inline-grid|hidden|table|contents|flow-root)$/, properties: ['display'] },
  { name: 'position', pattern: /^(static|fixed|absolute|relative|sticky)$/, properties: ['position'] },
  { name: 'padding-all', pattern: /^p-(\d+|px|\[.+\]|auto)$/, properties: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'] },
  { name: 'padding-x', pattern: /^px-(\d+|px|\[.+\]|auto)$/, properties: ['padding-left', 'padding-right'] },
  { name: 'padding-y', pattern: /^py-(\d+|px|\[.+\]|auto)$/, properties: ['padding-top', 'padding-bottom'] },
  { name: 'padding-top', pattern: /^pt-(\d+|px|\[.+\]|auto)$/, properties: ['padding-top'] },
  { name: 'padding-right', pattern: /^pr-(\d+|px|\[.+\]|auto)$/, properties: ['padding-right'] },
  { name: 'padding-bottom', pattern: /^pb-(\d+|px|\[.+\]|auto)$/, properties: ['padding-bottom'] },
  { name: 'padding-left', pattern: /^pl-(\d+|px|\[.+\]|auto)$/, properties: ['padding-left'] },
  { name: 'margin-all', pattern: /^m-(\d+|px|\[.+\]|auto)$/, properties: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'] },
  { name: 'margin-x', pattern: /^mx-(\d+|px|\[.+\]|auto)$/, properties: ['margin-left', 'margin-right'] },
  { name: 'margin-y', pattern: /^my-(\d+|px|\[.+\]|auto)$/, properties: ['margin-top', 'margin-bottom'] },
  { name: 'margin-top', pattern: /^mt-(\d+|px|\[.+\]|auto)$/, properties: ['margin-top'] },
  { name: 'margin-right', pattern: /^mr-(\d+|px|\[.+\]|auto)$/, properties: ['margin-right'] },
  { name: 'margin-bottom', pattern: /^mb-(\d+|px|\[.+\]|auto)$/, properties: ['margin-bottom'] },
  { name: 'margin-left', pattern: /^ml-(\d+|px|\[.+\]|auto)$/, properties: ['margin-left'] },
  { name: 'width', pattern: /^w-(\d+|px|full|screen|auto|fit|min|max|\[.+\]|\d+\/\d+)$/, properties: ['width'] },
  { name: 'height', pattern: /^h-(\d+|px|full|screen|auto|fit|min|max|\[.+\]|\d+\/\d+)$/, properties: ['height'] },
  { name: 'text-align', pattern: /^text-(left|center|right|justify|start|end)$/, properties: ['text-align'] },
  { name: 'font-weight', pattern: /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/, properties: ['font-weight'] },
  { name: 'font-size', pattern: /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/, properties: ['font-size'] },
  { name: 'text-color', pattern: /^text-(?:\[(?:.+)\]|(?:red|blue|green|yellow|purple|pink|gray|grey|indigo|black|white|orange|teal|cyan|slate|zinc|neutral|stone|amber|lime|emerald|sky|violet|fuchsia|rose)(?:-?\d{0,3})?)$/, properties: ['color'] },
  { name: 'background-color', pattern: /^bg-(?:\[(?:.+)\]|(?:red|blue|green|yellow|purple|pink|gray|grey|indigo|black|white|orange|teal|cyan|slate|zinc|neutral|stone|amber|lime|emerald|sky|violet|fuchsia|rose)(?:-?\d{0,3})?)$/, properties: ['background-color'] },
  { name: 'flex-direction', pattern: /^flex-(row|row-reverse|col|col-reverse)$/, properties: ['flex-direction'] },
  { name: 'justify-content', pattern: /^justify-(start|end|center|between|around|evenly)$/, properties: ['justify-content'] },
  { name: 'align-items', pattern: /^items-(start|end|center|baseline|stretch)$/, properties: ['align-items'] },
  { name: 'border-radius', pattern: /^rounded(-\w+)?(-\d+)?$/, properties: ['border-radius'] },
  { name: 'overflow', pattern: /^overflow-(auto|hidden|visible|scroll|x-auto|x-hidden|y-auto|y-hidden)$/, properties: ['overflow'] },
  { name: 'float', pattern: /^float-(left|right|none)$/, properties: ['float'] },
  { name: 'shadow', pattern: /^shadow(-[a-z]+)?$/, properties: ['box-shadow'] },
  { name: 'opacity', pattern: /^opacity-(0|25|50|75|100)$/, properties: ['opacity'] },
  { name: 'gap', pattern: /^gap-(\d+|px|\[.+\]|auto)$/, properties: ['gap'] },
  { name: 'gap-x', pattern: /^gap-x-(\d+|px|\[.+\]|auto)$/, properties: ['column-gap'] },
  { name: 'gap-y', pattern: /^gap-y-(\d+|px|\[.+\]|auto)$/, properties: ['row-gap'] },
  { name: 'border', pattern: /^border(?:-(\d+|px|solid|dashed|dotted|double|none))?$/, properties: ['border-top', 'border-right', 'border-bottom', 'border-left'] },
  { name: 'border-x', pattern: /^border-x(?:-(\d+|px|solid|dashed|dotted|double|none))?$/, properties: ['border-left', 'border-right'] },
  { name: 'border-y', pattern: /^border-y(?:-(\d+|px|solid|dashed|dotted|double|none))?$/, properties: ['border-top', 'border-bottom'] },
  { name: 'border-top', pattern: /^border-t(?:-(\d+|px|solid|dashed|dotted|double|none))?$/, properties: ['border-top'] },
  { name: 'border-right', pattern: /^border-r(?:-(\d+|px|solid|dashed|dotted|double|none))?$/, properties: ['border-right'] },
  { name: 'border-bottom', pattern: /^border-b(?:-(\d+|px|solid|dashed|dotted|double|none))?$/, properties: ['border-bottom'] },
  { name: 'border-left', pattern: /^border-l(?:-(\d+|px|solid|dashed|dotted|double|none))?$/, properties: ['border-left'] },
  { name: 'ring', pattern: /^ring(?:-(\d+|px|offset|inset|white|black|red|blue|green|yellow|purple|pink|gray|slate|zinc|neutral|stone|amber|emerald|teal|cyan|sky|violet|fuchsia|rose)(?:-?\d{0,3})?)?$/, properties: ['box-shadow'] },
  { name: 'ring-offset', pattern: /^ring-offset(?:-(\d+|px|white|black|red|blue|green|yellow|purple|pink|gray|slate|zinc|neutral|stone|amber|emerald|teal|cyan|sky|violet|fuchsia|rose)(?:-?\d{0,3})?)?$/, properties: ['box-shadow'] },
  { name: 'text-decoration', pattern: /^(underline|line-through|no-underline)$/, properties: ['text-decoration'] },
];

function splitVariant(cls) {
  const parts = cls.split(':');
  const base = parts.pop();
  const scope = parts.join(':') || '__base__';
  return { scope, base };
}

function normalizeBaseClass(baseClass) {
  return baseClass.replace(/^(?:[A-Za-z0-9_-]+:)+/, '');
}

function categorize(baseClass) {
  const normalized = normalizeBaseClass(baseClass);
  for (const def of UTILITY_DEFINITIONS) {
    if (def.pattern.test(normalized)) return { category: def.name, properties: def.properties };
  }
  return null;
}

function detectTailwindConflicts(classString, context = '') {
  const classes = classString.split(/\s+/).filter(Boolean);
  const byScope = new Map();

  for (const cls of classes) {
    const { scope, base } = splitVariant(cls);
    const info = categorize(base);
    if (!info) continue;
    if (!byScope.has(scope)) {
      byScope.set(scope, { propertyMap: new Map(), classMeta: new Map() });
    }

    const scopeData = byScope.get(scope);
    scopeData.classMeta.set(cls, info.category);

    for (const property of info.properties) {
      if (!scopeData.propertyMap.has(property)) scopeData.propertyMap.set(property, []);
      scopeData.propertyMap.get(property).push(cls);
    }
  }

  const conflicts = [];
  for (const [scope, scopeData] of byScope) {
    const groupedConflicts = new Map();

    for (const clsList of scopeData.propertyMap.values()) {
      if (clsList.length <= 1) continue;
      const uniqueClasses = Array.from(new Set(clsList)).sort();
      const key = uniqueClasses.join('|');
      const conflict = groupedConflicts.get(key) || { classes: uniqueClasses, categories: new Set() };
      uniqueClasses.forEach(cls => conflict.categories.add(scopeData.classMeta.get(cls)));
      groupedConflicts.set(key, conflict);
    }

    for (const conflict of groupedConflicts.values()) {
          const rawCategory = [...conflict.categories][0];
      const category = rawCategory.replace(/-(all|x|y|top|right|bottom|left)$/, '');
      conflicts.push({
        type: 'tailwind-conflict',
        severity: 'warning',
        scope: scope === '__base__' ? '(no variant)' : scope,
        category,
        classes: conflict.classes,
        context,
        message: `Conflicting "${category}" utilities in the same scope${scope !== '__base__' ? ` (${scope}:)` : ''}: ${conflict.classes.join(', ')}. The later class in the source order usually wins, so this may be unintended.`,
      });
    }
  }

  return conflicts;
}

/**
 * Pulls class strings out of JSX/HTML/template files for Tailwind conflict analysis.
 * Handles:
 *   - className="..." and class="..."
 *   - className={`...`} template literals
 *   - cn('...', '...'), clsx('...'), twMerge('...') call expressions
 *   - Object keys in cn({ 'class-name': condition }) syntax
 */
function extractClassStringsFromMarkup(source) {
  const results = [];

  // 1. Simple string and template-literal className/class attributes
  const attrPattern = /(?:className|class)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g;
  let match;
  while ((match = attrPattern.exec(source)) !== null) {
    const raw = match[1] ?? match[2] ?? match[3] ?? '';
    const cleaned = raw.replace(/\$\{[^}]*\}/g, '').trim();
    if (cleaned) results.push(cleaned);
  }

  // 2. cn(...), clsx(...), twMerge(...), tw(...) call expressions
  // Extract all string literal arguments and object-syntax string keys.
  const callPattern = /\b(?:cn|clsx|twMerge|tw|classNames)\s*\(([^)]{0,800})\)/g;
  while ((match = callPattern.exec(source)) !== null) {
    const args = match[1];
    // String literal args: 'foo bar' or "foo bar"
    const stringArgs = /(?:"|')([^"']+)(?:"|')/g;
    let strMatch;
    const collected = [];
    while ((strMatch = stringArgs.exec(args)) !== null) {
      collected.push(strMatch[1].trim());
    }
    if (collected.length > 0) {
      // Join all string args into one class list for conflict detection
      results.push(collected.join(' '));
    }
  }

  return results;
}

module.exports = { detectTailwindConflicts, extractClassStringsFromMarkup };
