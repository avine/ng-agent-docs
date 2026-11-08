import { Node } from 'ts-morph';
import type { Doc } from './model.mts';
import { toLf } from './util.mts';

// =============================================================================
// JSDoc parsing
// =============================================================================
// Our tags.
const DOC_TAGS = ['usage', 'avoid', 'replacedBy', 'replaces', 'example', 'deprecated'];

// One of our tags after text on the same line, as in a one-line JSDoc: `/** Old. @deprecated Use FxNew. */`.
const INLINE_TAG = new RegExp(`\\s+(?=@(?:${DOC_TAGS.join('|')})\\b)`, 'g');

// Angular control flow at the start of a line, in an @example without a code fence: content, not a tag.
const CONTROL_FLOW = /^@(?:(?:if|for|switch|case|default|defer|placeholder|loading|error|empty)\s*[({]|else\b|let\s)/;

// `Old. @deprecated Use FxNew.` → ['Old.', '@deprecated Use FxNew.']. Not at the start of the line
// (an indented tag is content), nor in inline code.
const splitAtInlineTags = (line: string) => {
  const parts: string[] = [];
  let start = 0;
  for (const m of line.matchAll(INLINE_TAG)) {
    const before = line.slice(0, m.index);
    if (!before.trim() || (before.match(/`/g)?.length ?? 0) % 2) continue;
    parts.push(line.slice(start, m.index));
    start = m.index + m[0].length;
  }
  return [...parts, line.slice(start)];
};

/**
 * Splits the raw text of a JSDoc block into its description and its tags.
 *
 * We don't use TypeScript's own tag parsing: it starts a new tag at any `@` after a space, which cuts
 * an @example at its first `@if` or `@for`, and a description at `@Input()`. Here a tag starts only on
 * a line that begins with `@` at column 0, outside a ``` code fence, and not with Angular control flow
 * in an @example. Indented lines are always content. Only our own tags can follow text on a line.
 */
function parseJsDoc(text: string) {
  const description: string[] = [];
  const tags: { name: string; text: string }[] = [];
  let inFence = false;
  for (const raw of text.split('\n')) {
    for (const line of inFence ? [raw] : splitAtInlineTags(raw)) {
      const last = tags.at(-1);
      const content = inFence || (last?.name === 'example' && CONTROL_FLOW.test(line));
      const tag = content ? null : /^@(\w+)\s?(.*)$/.exec(line);
      if (tag) tags.push({ name: tag[1] ?? '', text: tag[2] ?? '' });
      else if (last) last.text += '\n' + line;
      else description.push(line);
      if (line.trimStart().startsWith('```')) inFence = !inFence;
    }
  }
  return { description: description.join('\n').trim(), tags: tags.map((t) => ({ ...t, text: t.text.trim() })) };
}

/**
 * Reads the JSDoc block closest to a node and extracts the description and our custom tags.
 * To support a new tag: add a field to `Doc`, its name to DOC_TAGS, a `case` here, and render it in `header()`.
 */
export function readDoc(node: Node): Doc {
  const doc: Doc = { usage: [], avoid: [], replaces: [], examples: [] };
  // For `export const X = ...`, the JSDoc is attached to the statement, not to the declaration.
  const host = Node.isVariableDeclaration(node) ? node.getVariableStatement() : node;
  if (!host || !Node.isJSDocable(host)) return doc;
  const jsDoc = host.getJsDocs().at(-1); // the last block is the one directly above the code
  if (!jsDoc) return doc;

  // With CRLF, the `\r` left at the end of each line would stop parseJsDoc from finding the tags.
  const { description, tags } = parseJsDoc(toLf(jsDoc.getInnerText()));
  doc.description = description || undefined;
  for (const { name, text } of tags) {
    switch (name) {
      case 'usage': doc.usage.push(text); break;
      case 'avoid': doc.avoid.push(text); break;
      case 'replacedBy': doc.replacedBy = text; break;
      case 'replaces': doc.replaces.push(text); break;
      case 'deprecated': doc.deprecated = text || 'yes'; break;
      case 'example': doc.examples.push(text); break;
    }
  }
  return doc;
}
