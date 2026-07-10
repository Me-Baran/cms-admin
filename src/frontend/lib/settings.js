/**
 * Site settings parser/serializer — generic version.
 *
 * Works with any JS/TS config file that exports a const object.
 * The manifest's `settings` config tells us which file to read.
 *
 * For auto-detected settings (src/config.ts), we parse the first
 * `export const ... = { ... }` block we find.
 *
 * For custom settings with explicit fields, we render a form from the field definitions.
 */

/**
 * Parse a config file content into a settings object.
 * Tries to find `export const <name> = { ... }` blocks.
 */
export function parseConfig(content) {
  // Try to find the main export (SITE, CONFIG, etc.)
  const match = content.match(/export\s+const\s+(\w+)\s*=\s*\{([\s\S]*?)\}\s*(?:as\s+const)?\s*;/);
  if (!match) {
    throw new Error('Could not find a const object export in config file');
  }

  const exportName = match[1];
  const objStr = match[2];
  return { [exportName]: parseObject(objStr) };
}

/**
 * Get a specific export from parsed config.
 */
export function getConfigValue(parsed, key) {
  return parsed?.[key];
}

/**
 * Parse a JS object literal string into a plain object.
 */
function parseObject(str) {
  const result = {};
  let i = 0;

  while (i < str.length) {
    while (i < str.length && /\s/.test(str[i])) i++;
    if (i >= str.length) break;
    if (str[i] === ',') { i++; continue; }

    const keyMatch = str.slice(i).match(/^(\w+)\s*:/);
    if (!keyMatch) { i++; continue; }
    const key = keyMatch[1];
    i += keyMatch[0].length;

    while (i < str.length && /\s/.test(str[i])) i++;
    const { value, newIndex } = parseValue(str, i);
    result[key] = value;
    i = newIndex;
  }

  return result;
}

function parseValue(str, i) {
  while (i < str.length && /\s/.test(str[i])) i++;

  if (str[i] === "'" || str[i] === '"') return parseString(str, i);
  if (str[i] === '`') return parseTemplateLiteral(str, i);
  if (str[i] === '[') return parseArray(str, i);
  if (str[i] === '{') return parseNestedObject(str, i);

  const rest = str.slice(i);
  const numMatch = rest.match(/^-?\d+(\.\d+)?/);
  if (numMatch) return { value: parseFloat(numMatch[0]), newIndex: i + numMatch[0].length };
  if (rest.startsWith('true')) return { value: true, newIndex: i + 4 };
  if (rest.startsWith('false')) return { value: false, newIndex: i + 5 };
  if (rest.startsWith('null')) return { value: null, newIndex: i + 4 };

  const end = str.indexOf(',', i);
  const brace = str.indexOf('}', i);
  const next = Math.min(
    end === -1 ? str.length : end,
    brace === -1 ? str.length : brace
  );
  return { value: str.slice(i, next).trim(), newIndex: next };
}

function parseString(str, i) {
  const quote = str[i];
  let j = i + 1;
  while (j < str.length && str[j] !== quote) {
    if (str[j] === '\\') j++;
    j++;
  }
  return { value: str.slice(i + 1, j).replace(/\\'/g, "'").replace(/\\"/g, '"'), newIndex: j + 1 };
}

function parseTemplateLiteral(str, i) {
  let j = i + 1;
  while (j < str.length && str[j] !== '`') j++;
  return { value: str.slice(i + 1, j), newIndex: j + 1 };
}

function parseArray(str, i) {
  i++;
  const arr = [];
  while (i < str.length && str[i] !== ']') {
    while (i < str.length && /\s/.test(str[i])) i++;
    if (str[i] === ']') break;
    if (str[i] === ',') { i++; continue; }
    const { value, newIndex } = parseValue(str, i);
    arr.push(value);
    i = newIndex;
  }
  return { value: arr, newIndex: i + 1 };
}

function parseNestedObject(str, i) {
  i++;
  let depth = 1;
  const start = i;
  while (i < str.length && depth > 0) {
    if (str[i] === '{') depth++;
    if (str[i] === '}') depth--;
    if (depth > 0) i++;
  }
  return { value: parseObject(str.slice(start, i)), newIndex: i + 1 };
}

/**
 * Serialize a settings object back to config file format.
 * @param {string} exportName - The export name (e.g. 'SITE', 'CONFIG')
 * @param {object} settings - The settings object
 * @param {string} [restOfFile] - Any content after the main export to preserve
 */
export function serializeConfig(exportName, settings, restOfFile = '') {
  const lines = [];
  lines.push(`export const ${exportName} = {`);

  const entries = Object.entries(settings);
  for (let idx = 0; idx < entries.length; idx++) {
    const [key, value] = entries[idx];
    const comma = idx < entries.length - 1 ? ',' : '';
    lines.push(`  ${key}: ${formatValue(value, 1)}${comma}`);
  }

  lines.push('} as const;');

  if (restOfFile) {
    lines.push('');
    lines.push(restOfFile.trim());
  }
  lines.push('');

  return lines.join('\n');
}

function formatValue(value, depth = 0) {
  const indent = '  '.repeat(depth + 1);

  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (value.includes("'") && !value.includes('"')) return `"${value}"`;
    return `'${value.replace(/'/g, "\\'")}'`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map(v => `${indent}${formatValue(v, depth + 1)},`);
    return `[\n${items.join('\n')}\n${'  '.repeat(depth)}]`;
  }

  if (typeof value === 'object') {
    const innerIndent = '  '.repeat(depth + 1);
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    const props = entries.map(([k, v], i) => {
      const comma = i < entries.length - 1 ? ',' : '';
      return `${innerIndent}${k}: ${formatValue(v, depth + 1)}${comma}`;
    });
    return `{\n${props.join('\n')}\n${'  '.repeat(depth)}}`;
  }

  return String(value);
}

/**
 * Parse src/config.ts specifically, extracting the SITE object.
 * This is a convenience wrapper for the common case.
 */
export function parseSiteConfig(content) {
  const parsed = parseConfig(content);
  return parsed.SITE || parsed.CONFIG || parsed.site || parsed.config || Object.values(parsed)[0];
}

/**
 * Serialize settings back to src/config.ts format.
 * Preserves the original export name and any NAV-like exports.
 */
export function serializeSiteConfig(content, settings, exportName = 'SITE') {
  // Find any content after the main export block
  const mainExportRegex = new RegExp(
    `export\\s+const\\s+${exportName}\\s*=\\s*\\{[\\s\\S]*?\\}\\s*(?:as\\s+const)?\\s*;`
  );
  const match = content.match(mainExportRegex);
  let restOfFile = '';
  if (match) {
    restOfFile = content.slice(match.index + match[0].length);
  }

  return serializeConfig(exportName, settings, restOfFile);
}
