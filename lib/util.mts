import { sep } from 'node:path';
import {
  type ClassDeclaration,
  type Decorator,
  type GetAccessorDeclaration,
  type MethodDeclaration,
  Node,
  type ObjectLiteralExpression,
  type PropertyDeclaration,
  Scope,
  type Type,
  TypeFormatFlags,
} from 'ts-morph';
import { NG_DECORATORS } from './model.mts';

// =============================================================================
// Generic helpers
// =============================================================================
// Print types as the consumer sees them: keep alias names (ButtonVariant, not the union), never truncate.
export const TYPE_FORMAT =
  TypeFormatFlags.UseAliasDefinedOutsideCurrentScope | TypeFormatFlags.NoTruncation;
export const typeText = (t: Type, at: Node) => t.getText(at, TYPE_FORMAT);

// Collapse a multi-line text (a default value, a description) to one line, for a list item.
export const oneLine = (s = '') => s.replace(/\s+/g, ' ').trim();

// Inline code that survives backticks in its content (template literals): `x`, or `` a`b `` when needed.
export const code = (s: string) => {
  const text = oneLine(s);
  const longestRun = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longestRun + 1);
  return longestRun ? `${fence} ${text} ${fence}` : `${fence}${text}${fence}`;
};

// First paragraph of a description, on one line, for the one-line lists of a page. It can be wrapped over
// several lines, and ends at a blank line, a list, a heading, a quote, a table or a code fence.
export const firstParagraph = (s = '') => {
  const lines = s.trim().split('\n');
  const end = lines.findIndex((l, i) => i > 0 && /^\s*($|[-*+>#|]|\d+\.\s|```)/.test(l));
  return oneLine(lines.slice(0, end < 0 ? undefined : end).join(' '));
};

// First sentence of a description, for the index: it ends at `.`, `!` or `?` followed by a capital letter
// (`e.g. this` does not end it), or with the first paragraph.
export const summary = (s = '') => {
  const paragraph = firstParagraph(s);
  return /^.*?[.!?](?=\s+\p{Lu})/u.exec(paragraph)?.[0] ?? paragraph;
};
// CRLF (sources checked out on Windows with git's autocrlf) → LF, so the output does not depend on the OS.
export const toLf = (s: string) => s.replace(/\r\n?/g, '\n');
export const codeBlock = (lang: string, s: string) =>
  '```' + lang + '\n' + toLf(s.trim()) + '\n```';
export const toPosix = (p: string) => p.split(sep).join('/');
// `dir` itself, or anything below it. Works for a root folder too (`/` or `C:\`).
export const isInside = (file: string, dir: string) =>
  file === dir || file.startsWith(dir.endsWith(sep) ? dir : dir + sep);

// Sort order of the index. A fixed locale: `localeCompare()` alone follows the machine's locale,
// so the output (and the snapshot test) could change from one machine to another.
export const byName = new Intl.Collator('en').compare;

// Value of a string literal node ('x', "x" or `x`), otherwise undefined.
export const str = (n?: Node) =>
  n && (Node.isStringLiteral(n) || Node.isNoSubstitutionTemplateLiteral(n))
    ? n.getLiteralText()
    : undefined;

// Initializer of property `name` in an object literal, e.g. `selector` in `{ selector: 'lx-button' }`.
export const propOf = (obj: ObjectLiteralExpression | undefined, name: string) => {
  const p = obj?.getProperty(name);
  return p && Node.isPropertyAssignment(p) ? p.getInitializer() : undefined;
};

// Metadata object passed to a decorator: @Component({ ... }) → { ... }
export const metadata = (d?: Decorator) => {
  const arg = d?.getArguments()[0];
  return arg && Node.isObjectLiteralExpression(arg) ? arg : undefined;
};

// The Angular decorator of a class (@Component, @Directive, @Pipe, @Injectable, @Service, @NgModule), if any.
export const ngDecorator = (cls: ClassDeclaration) =>
  cls.getDecorators().find((d) => d.getName() in NG_DECORATORS);

// Public, non-static, not #private. Used to filter members of services and classes.
export const isPublic = (m: PropertyDeclaration | MethodDeclaration | GetAccessorDeclaration) =>
  m.getScope() === Scope.Public && !m.isStatic() && !m.getName().startsWith('#');

// Public and static, e.g. `static forRoot()` of an NgModule, or a factory method of a plain class.
export const isPublicStatic = (
  m: PropertyDeclaration | MethodDeclaration | GetAccessorDeclaration,
) => m.getScope() === Scope.Public && m.isStatic() && !m.getName().startsWith('#');

// Package that declares a file of node_modules: `.../node_modules/@angular/core/index.d.ts` → `@angular/core`.
export const packageOf = (file: string) =>
  [...toPosix(file).matchAll(/\/node_modules\/((?:@[^/]+\/)?[^/]+)\//g)].at(-1)?.[1] ??
  'another package';
