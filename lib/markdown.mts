import { posix } from 'node:path';
import type { HostDirective } from './host-directives.mts';
import {
  type BindingKind,
  type Context,
  type Doc,
  type Entry,
  type EntryPoint,
  EXTRA_DOCS_DIR,
  GENERATED_MARKER,
  type Kind,
  type Member,
  type Owners,
} from './model.mts';
import { code, codeBlock, oneLine, summary } from './util.mts';

// =============================================================================
// Markdown rendering — the parts shared by every page, and the index.
// Each page is assembled in describe.mts, which holds its kind-specific sections.
// =============================================================================
/** Top of every symbol page: title, import line(s), warnings, description, @usage and @avoid. */
export function header(name: string, kind: Kind, doc: Doc, ctx: Context, extra: string[] = []): string[] {
  const lines = [`# ${name} (${kind})`, '', `\`import { ${name} } from '${ctx.ep.importPath}';\``];
  const alsoFrom = ctx.alsoFrom.map((x) => `\`${x.importPath}\`` + (x.name === name ? '' : ` as \`${x.name}\``));
  if (alsoFrom.length) lines.push('', `Also exported from: ${alsoFrom.join(', ')}`);
  lines.push(...extra.flatMap((x) => ['', x]));
  if (doc.deprecated) lines.push('', `> ⚠️ Deprecated: ${doc.deprecated}`);
  if (doc.replacedBy) lines.push('', `> ⚠️ For new code, use instead: ${doc.replacedBy}`);
  if (doc.replaces.length) lines.push('', `Replaces: ${doc.replaces.join(', ')}`);
  if (doc.description) lines.push('', doc.description);
  if (doc.usage.length) lines.push('', '## When to use', ...doc.usage.map((u) => `- ${u}`));
  if (doc.avoid.length) lines.push('', '## When not to use', ...doc.avoid.map((a) => `- ${a}`));
  return lines;
}

// Binding syntax used as the name of each list item: what the agent writes in the template.
const BINDING_SYNTAX: Record<BindingKind, (name: string) => string> = {
  input: (name) => `[${name}]`,
  model: (name) => `[(${name})]`,
  output: (name) => `(${name})`,
};

/**
 * One list item per binding, every fact labeled where it appears (no table: the agent reads raw
 * Markdown, where a table needs `\|` escapes and column counting, and empty cells waste tokens):
 *   - `[aria-label]: string` **required** — Accessible label.
 *   - `[loading]: boolean` = `false` · transform: booleanAttribute — Shows a spinner.
 *   - `[kind]: Variant | undefined` ⚠️ deprecated: Use `variant`. — Old name of `variant`.
 * Missing facts are left out.
 */
export function memberList(title: string, binding: BindingKind, list: Member[], note?: string): string[] {
  if (!list.length) return [];
  const items = list.map(
    (m) =>
      `- ${code(`${BINDING_SYNTAX[binding](m.name)}: ${m.type}`)}` +
      (m.required ? ' **required**' : '') +
      (m.default ? ` = ${code(m.default)}` : '') +
      (m.transform ? ` · transform: ${m.transform}` : '') +
      (m.inheritedFrom ? ` · inherited from ${m.inheritedFrom.getName()}` : '') +
      (m.fromHostDirective ? ` · from host directive ${m.fromHostDirective.getName()}` : '') +
      (m.deprecated ? ` ⚠️ deprecated: ${oneLine(m.deprecated)}` : '') +
      (m.description ? ` — ${oneLine(m.description)}` : ''),
  );
  return ['', `## ${title}`, ...(note ? [note, ''] : []), ...items];
}

/**
 * One host directive, linked to its page when the library documents it:
 *   - [FxTooltip](../../overlay/FxTooltip.md): exposes `[hint]`, `(tooltipToggle)`
 *   - NgStyle (`@angular/common`): exposes `[panelStyle]`
 */
export function hostDirectiveLine(d: HostDirective, fromPage: string, owners: Owners): string {
  const target = d.decl && owners.get(d.decl)?.ctx.page;
  const label = d.pkg
    ? `${d.name} (\`${d.pkg}\`)`
    : target
      ? `[${d.name}](${posix.relative(posix.dirname(fromPage), target)})`
      : `${d.name} (not exported by the library)`;
  const exposed = d.exposed.map((x) => code(BINDING_SYNTAX[x.binding](x.name)));
  return `- ${label}: exposes ${exposed.length ? exposed.join(', ') : 'nothing'}`;
}

// An @example without a code fence is assumed to be an HTML template snippet.
export const examples = (doc: Doc) =>
  doc.examples.length
    ? ['', '## Examples', ...doc.examples.map((x) => (x.includes('```') ? x : codeBlock('html', x)))]
    : [];

// =============================================================================
// Index — one section per entry point, then one sub-section per kind
// =============================================================================
const GROUPS: [Kind[], string][] = [
  [['component'], 'Components'],
  [['directive'], 'Directives'],
  [['pipe'], 'Pipes'],
  [['service'], 'Services'],
  [['interface', 'type', 'enum'], 'Types'],
  [['function', 'const', 'class'], 'Functions, constants and classes'],
];

// Index line: link, selector or pipe name, first sentence of the description, replacement hints.
const indexLine = (e: Entry) =>
  `- [${e.name}](${e.page})` +
  (e.selector ? ` \`${e.selector}\`` : '') +
  (e.pipeName ? ` \`| ${e.pipeName}\`` : '') +
  (e.doc.description ? ` — ${summary(e.doc.description)}` : '') +
  (e.doc.replaces.length ? ` (replaces ${e.doc.replaces.join(', ')})` : '') +
  (e.doc.replacedBy ? ` → ⚠️ prefer ${e.doc.replacedBy}` : '') +
  (e.doc.deprecated ? ' (deprecated)' : '');

const entryPointSection = (ep: EntryPoint, entries: Entry[]) => {
  const own = entries.filter((e) => e.ep === ep);
  if (!own.length) return []; // e.g. an empty primary entry point
  return [
    '',
    `## \`${ep.importPath}\`${ep.description ? ` — ${summary(ep.description)}` : ''}`,
    ...GROUPS.flatMap(([kinds, title]) => {
      const list = own.filter((e) => kinds.includes(e.kind));
      return list.length ? ['', `### ${title}`, ...list.map(indexLine)] : [];
    }),
  ];
};

/** What index.md needs from the command line. */
export interface IndexOptions {
  pkg: { name: string; version: string };
  notes: string[]; // --note lines
  extraDocs: boolean; // --extra-docs given: link its copy
  extraDocsNotes: string[]; // --extra-docs-note lines
}

// Last section: link to the extra docs, after the --extra-docs-note lines, if any.
const extraDocsSection = (opts: IndexOptions) =>
  opts.extraDocs
    ? [
        '',
        '## Additional documentation',
        '',
        ...(opts.extraDocsNotes.length ? [...opts.extraDocsNotes, ''] : []),
        `[${EXTRA_DOCS_DIR}/index.md](${EXTRA_DOCS_DIR}/index.md)`,
      ]
    : [];

/** Content of index.md. The intro lines are instructions for the agent reading it: add yours with --note. */
export const renderIndex = (entryPoints: EntryPoint[], entries: Entry[], opts: IndexOptions) =>
  [
    `# ${opts.pkg.name} ${opts.pkg.version} — Public API`,
    '',
    GENERATED_MARKER,
    '',
    ...opts.notes,
    'Read this index, then only the relevant `api/.../<Symbol>.md` file.',
    'Import each symbol from the entry point given in its section heading.',
    ...entryPoints.flatMap((ep) => entryPointSection(ep, entries)),
    ...extraDocsSection(opts),
  ].join('\n');
