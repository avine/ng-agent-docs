import { posix } from 'node:path';
import { Node } from 'ts-morph';
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
  warn,
} from './model.mts';
import { code, codeBlock, oneLine, packageOf, summary } from './util.mts';

// =============================================================================
// Markdown rendering — the parts shared by every page, and the index.
// Each page is assembled in describe.mts, which holds its kind-specific sections.
// =============================================================================
// A JSDoc tag can span several lines: each one is quoted, or indented to stay in its list item.
const quote = (s: string) =>
  s
    .split('\n')
    .map((l) => `> ${l}`.trimEnd())
    .join('\n');
const item = (s: string, indent = '') =>
  `${indent}- ` +
  s
    .split('\n')
    .map((l, i) => (i && l.trim() ? `${indent}  ${l}` : l))
    .join('\n');

/** Top of every symbol page: title, import line(s), warnings, description, @usage and @avoid. */
export function header(
  name: string,
  kind: Kind,
  doc: Doc,
  ctx: Context,
  extra: string[] = [],
): string[] {
  const lines = [`# ${name} (${kind})`, '', `\`import { ${name} } from '${ctx.ep.importPath}';\``];
  const alsoFrom = ctx.alsoFrom.map(
    (x) => `\`${x.importPath}\`` + (x.name === name ? '' : ` as \`${x.name}\``),
  );
  if (alsoFrom.length) lines.push('', `Also exported from: ${alsoFrom.join(', ')}`);
  lines.push(...extra.flatMap((x) => ['', x]));
  if (doc.deprecated !== undefined)
    lines.push('', quote(`⚠️ Deprecated${doc.deprecated ? `: ${doc.deprecated}` : '.'}`));
  if (doc.replacedBy) lines.push('', quote(`⚠️ For new code, use instead: ${doc.replacedBy}`));
  if (doc.replaces.length) lines.push('', `Replaces: ${doc.replaces.map(oneLine).join(', ')}`);
  if (doc.description) lines.push('', doc.description);
  if (doc.usage.length) lines.push('', '## When to use', ...doc.usage.map((u) => item(u)));
  if (doc.avoid.length) lines.push('', '## When not to use', ...doc.avoid.map((a) => item(a)));
  return lines;
}

/** Parameters and return value of a function or pipe page, from @param and @returns. */
export const paramSection = (doc: Doc) => [
  ...(doc.params.length
    ? [
        '',
        '## Parameters',
        ...doc.params.map((p) => item(`\`${p.name}\`${p.text ? ` — ${p.text}` : ''}`)),
      ]
    : []),
  ...(doc.returns ? ['', '## Returns', doc.returns] : []),
];

/** The same, as sub-items of a method in a list: one line each. */
export const paramItems = (doc: Doc) => [
  ...doc.params.map((p) => `  - \`${p.name}\`${p.text ? `: ${oneLine(p.text)}` : ''}`),
  ...(doc.returns ? [`  - **returns**: ${oneLine(doc.returns)}`] : []),
];

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
 *   - `[max]: number` · transform: toNumber · accepts: `string | number` — Maximum value.
 *   - `[kind]: Variant | undefined` ⚠️ deprecated: Use `variant`. — Old name of `variant`.
 * Missing facts are left out. `subItems` follow each item: its @see tags.
 */
export function memberList(
  title: string,
  binding: BindingKind,
  list: Member[],
  subItems: (m: Member) => string[],
  note?: string,
): string[] {
  if (!list.length) return [];
  const items = list.flatMap((m) => [
    `- ${code(`${BINDING_SYNTAX[binding](m.name)}: ${m.type}`)}` +
      (m.required ? ' **required**' : '') +
      (m.default ? ` = ${code(m.default)}` : '') +
      (m.transform ? ` · transform: ${m.transform}` : '') +
      (m.accepts ? ` · accepts: ${code(m.accepts)}` : '') +
      (m.inheritedFrom ? ` · inherited from ${m.inheritedFrom.getName()}` : '') +
      (m.fromHostDirective ? ` · from host directive ${m.fromHostDirective.getName()}` : '') +
      (m.deprecated !== undefined
        ? ` ⚠️ deprecated${m.deprecated ? `: ${oneLine(m.deprecated)}` : ''}`
        : '') +
      (m.description ? ` — ${oneLine(m.description)}` : ''),
    ...subItems(m),
  ]);
  return ['', `## ${title}`, ...(note ? [note, ''] : []), ...items];
}

/**
 * A class another page refers to, linked to its page when the library documents it:
 *   [FxTooltip](../overlay/FxTooltip.md) · NgStyle (`@angular/common`) · FxRipple (not exported by the library)
 */
export function classLink(
  c: { name: string; decl?: Node | undefined; pkg?: string | undefined },
  fromPage: string,
  owners: Owners,
): string {
  const target = c.decl && owners.get(c.decl)?.ctx.page;
  return c.pkg
    ? `${c.name} (\`${c.pkg}\`)`
    : target
      ? `[${c.name}](${posix.relative(posix.dirname(fromPage), target)})`
      : `${c.name} (not exported by the library)`;
}

/**
 * One host directive, and the bindings the host exposes:
 *   - [FxTooltip](../../overlay/FxTooltip.md): exposes `[hint]`, `(tooltipToggle)`
 *   - NgStyle (`@angular/common`): exposes `[panelStyle]`
 *   - [FxAnchor](FxAnchor.md), from base class FxMenuTrigger: exposes nothing
 */
export function hostDirectiveLine(d: HostDirective, fromPage: string, owners: Owners): string {
  const via = d.fromBase ? `, from base class ${d.fromBase.getName()}` : '';
  const exposed = d.exposed.map((x) => code(BINDING_SYNTAX[x.binding](x.name)));
  return `- ${classLink(d, fromPage, owners)}${via}: exposes ${exposed.length ? exposed.join(', ') : 'nothing'}`;
}

// An @example without a code fence is assumed to be an HTML template snippet.
export const examples = (doc: Doc) =>
  doc.examples.length
    ? [
        '',
        '## Examples',
        ...doc.examples.map((x) => (x.includes('```') ? x : codeBlock('html', x))),
      ]
    : [];

// `{@link Target}`, `{@link Target | label}` or `{@link Target label}`; also {@linkcode …} and {@linkplain …}.
const LINK = /\{@link(code|plain)?\s+([^\s|}]+)\s*\|?\s*([^}]*)\}/g;
// A symbol name that starts a @see tag, without {@link}: `@see FxDialogRef.close, to close it`.
const LEADING_NAME = /^[A-Za-z_$][\w$]*(?:[.#][\w$]+)*(?:\(\))?(?=[\s,.;]|$)/;

/**
 * The @see tags of a JSDoc block, one text each. A reference TypeScript resolves is linked to the page that
 * documents it (a member: its class's page; not linked if that is the page being written), a URL is linked,
 * other text is kept as written:
 *   [FxDialogService](FxDialogService.md)
 *   [Opening a dialog](FxDialogService.md), then [FxDialogRef#close](FxDialogRef.md)
 *   [FxDialogRef.close()](FxDialogRef.md)
 *   NgStyle (`@angular/common`)
 * Warns about a {@link} that cannot be resolved, and about a reference to a library symbol without a page,
 * unless `quiet`: an inherited member is reported on the page of the class that declares it.
 * A bare name that cannot be resolved is taken as text: `@see the theming guide`.
 */
function seeRefs(
  name: string,
  doc: Doc,
  at: Node,
  fromPage: string,
  owners: Owners,
  quiet = false,
): string[] {
  const report = (message: string) => {
    if (!quiet) warn(message, at);
  };
  const ref = (
    target: string,
    label: string,
    explicit: boolean,
    asCode = false,
  ): string | undefined => {
    const text = asCode ? code(label) : label;
    if (/^https?:\/\//.test(target))
      return label === target ? `<${target}>` : `[${text}](${target})`;
    // `FxDialogRef.close()`: TypeScript resolves `FxDialogRef.close`, the `()` is text. The label keeps it.
    const decls = doc.seeTargets?.get(target.replace(/\(\)$/, ''));
    if (!decls) {
      if (explicit)
        report(`${name}: @see ${target} not found: import it in this file, or fix its name`);
      return explicit ? text : undefined;
    }
    const pageOf = (decl: Node) => {
      let owner: Node | undefined = decl;
      while (owner && !Node.isSourceFile(owner) && !owners.has(owner)) owner = owner.getParent();
      return owner && owners.get(owner)?.ctx.page;
    };
    // The first declaration with a page: an overloaded function's page is on its implementation.
    const page = decls.map(pageOf).find(Boolean);
    const decl = decls[0]!; // never empty (seeTargets)
    // A reference to the page being written is not linked: it would lead back to the same file.
    if (page)
      return page === fromPage
        ? text
        : `[${text}](${posix.relative(posix.dirname(fromPage), page)})`;
    if (decl.getSourceFile().isInNodeModules())
      return `${text} (\`${packageOf(decl.getSourceFile().getFilePath())}\`)`;
    report(`${name}: @see refers to ${target}, which has no page: export it from an entry point`);
    return `${text} (not exported by the library)`;
  };
  return doc.see.map((t) => {
    const lead = LEADING_NAME.exec(t)?.[0];
    const head = lead === undefined ? undefined : ref(lead, lead, false);
    const rest = head === undefined ? t : t.slice(lead!.length);
    const linked = rest.replace(
      LINK,
      (_, kind: string | undefined, target: string, label: string) =>
        ref(target, label.trim() || target, true, kind === 'code')!,
    );
    return (head ?? '') + linked;
  });
}

/** "See also" section of a page, from its @see tags (see seeRefs). */
export function seeAlso(
  name: string,
  doc: Doc,
  at: Node,
  fromPage: string,
  owners: Owners,
): string[] {
  const refs = seeRefs(name, doc, at, fromPage, owners);
  return refs.length ? ['', '## See also', ...refs.map((r) => item(r))] : [];
}

/**
 * The same, as sub-items of a member in a list (method, property, constructor, binding), one per tag:
 *   - `close(result?: R): void` — Closes the dialog.
 *     - **see**: [FxDialogService](FxDialogService.md)
 */
export const seeItems = (
  name: string,
  doc: Doc,
  at: Node,
  fromPage: string,
  owners: Owners,
  quiet = false,
) => seeRefs(name, doc, at, fromPage, owners, quiet).map((r) => item(`**see**: ${r}`, '  '));

// =============================================================================
// Index — one section per entry point, then one sub-section per kind
// =============================================================================
const GROUPS: [Kind[], string][] = [
  [['component'], 'Components'],
  [['directive'], 'Directives'],
  [['pipe'], 'Pipes'],
  [['service'], 'Services'],
  [['module'], 'NgModules'],
  [['interface', 'type', 'enum'], 'Types'],
  [['function', 'const', 'class'], 'Functions, constants and classes'],
];

// Index line: link, selector or pipe name, first sentence of the description, replacement hints.
const indexLine = (e: Entry) =>
  `- [${e.name}](${e.page})` +
  (e.selector ? ` \`${e.selector}\`` : '') +
  (e.pipeName ? ` \`| ${e.pipeName}\`` : '') +
  (e.doc.description ? ` — ${summary(e.doc.description)}` : '') +
  (e.doc.replaces.length ? ` (replaces ${e.doc.replaces.map(oneLine).join(', ')})` : '') +
  (e.doc.replacedBy ? ` → ⚠️ prefer ${oneLine(e.doc.replacedBy)}` : '') +
  (e.doc.deprecated !== undefined ? ' (deprecated)' : '');

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
  pkg: { name: string; version?: string | undefined };
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
    `# ${opts.pkg.name}${opts.pkg.version ? ` ${opts.pkg.version}` : ''} — Public API`,
    '',
    GENERATED_MARKER,
    '',
    ...opts.notes,
    'Read this index, then only the relevant `api/.../<Symbol>.md` file.',
    'Import each symbol from the entry point given in its section heading.',
    ...entryPoints.flatMap((ep) => entryPointSection(ep, entries)),
    ...extraDocsSection(opts),
  ].join('\n');
