import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import {
  type ClassDeclaration,
  Node,
  type ObjectLiteralExpression,
  type Type,
} from 'ts-morph';
import { HiddenTypes } from './hidden-types.mts';
import { fullBindings } from './host-directives.mts';
import { readDoc } from './jsdoc.mts';
import { constructorSection, documentedMethods, memberSections } from './members.mts';
import { classLink, examples, header, hostDirectiveLine, memberList, paramSection } from './markdown.mts';
import { type Context, type Doc, type Entry, type Kind, type Library, type Member, NG_DECORATORS, type Owners, warn } from './model.mts';
import { callSignatures, functionInitializer, overloadsOf, readFnDoc, signature } from './signatures.mts';
import {
  code,
  codeBlock,
  metadata,
  ngDecorator,
  oneLine,
  packageOf,
  propOf,
  str,
  toPosix,
  typeText,
} from './util.mts';

// =============================================================================
// Symbol description — one function per kind of export
// =============================================================================
/**
 * Content projection slots of a template, from its <ng-content> elements. A slot without `select` is
 * reported as "default", listed first. A `select` may hold the other kind of quote: "input[type='checkbox']".
 */
export function slotsOf(template: string): string[] {
  const html = template.replace(/<!--[\s\S]*?-->/g, ''); // a commented-out <ng-content> is not a slot
  const found = [...html.matchAll(/<ng-content(?=[\s/>])((?:[^>"']|"[^"]*"|'[^']*')*)>/g)].map((m) => {
    const select = /(?:^|\s)select\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(m[1] ?? '');
    return select?.[1] ?? select?.[2] ?? 'default';
  });
  // "default" first, the named slots keep their template order (sort is stable)
  return [...new Set(found)].sort((a, b) => Number(b === 'default') - Number(a === 'default'));
}

// Stands for a `${}` substitution whose value is not a constant: a slot whose `select` holds it is unknown.
const UNKNOWN = '\u{FFFC}';

/**
 * Text of an inline template. A `${}` substitution is replaced with its value when its type is a string or
 * number literal (`const PREFIX = 'fx'`), with UNKNOWN otherwise.
 */
function templateText(template: Node | undefined): string | undefined {
  if (!template || !Node.isTemplateExpression(template)) return str(template);
  const value = (e: Node) => {
    const t = e.getType();
    return t.isStringLiteral() || t.isNumberLiteral() ? String(t.getLiteralValue()) : UNKNOWN;
  };
  return template.getHead().getLiteralText() + template.getTemplateSpans().map((s) => value(s.getExpression()) + s.getLiteral().getLiteralText()).join('');
}

/**
 * Slots of a component: from its inline `template`, or its `templateUrl` file. A missing file, or a
 * `select` that depends on a value that is not a constant, is reported instead of being left out silently.
 */
function slots(name: string, cls: ClassDeclaration, meta?: ObjectLiteralExpression): string[] {
  const template = propOf(meta, 'template');
  let html = templateText(template);
  const urlNode = propOf(meta, 'templateUrl');
  const url = str(urlNode);
  if (html === undefined && url) {
    const file = resolve(dirname(cls.getSourceFile().getFilePath()), url);
    if (existsSync(file)) html = readFileSync(file, 'utf8');
    else warn(`${name}: templateUrl \`${url}\` not found, its content projection slots are not documented`, urlNode);
  }
  const found = html === undefined ? [] : slotsOf(html);
  for (const s of found.filter((x) => x.includes(UNKNOWN))) {
    warn(`${name}: an <ng-content> select (\`${s.replaceAll(UNKNOWN, '${…}')}\`) is not a constant, that slot is not documented`, template);
  }
  return found.filter((x) => !x.includes(UNKNOWN));
}

/** Classes: components, directives, pipes, services, or plain classes, based on their Angular decorator. */
function describeClass(name: string, kind: Kind, cls: ClassDeclaration, ctx: Context, lib: Library): Entry {
  const { owners } = lib;
  const hidden = new HiddenTypes(lib);
  const doc = readDoc(cls);
  const meta = metadata(ngDecorator(cls));
  const lines: string[] = [];
  let selector: string | undefined;
  let pipeName: string | undefined;

  if (kind === 'component' || kind === 'directive') {
    // --- Components and directives: selector, bindings, slots, documented public methods
    selector = str(propOf(meta, 'selector'));
    const exportAs = str(propOf(meta, 'exportAs'));
    const { inputs, outputs, models, directives } = fullBindings(cls);
    hidden.scan(...[...inputs, ...outputs, ...models].map((m) => m.decl));
    // No selector: a directive is an abstract base class (`@Directive()`), only meant to be extended;
    // a component is created from code (a route, a dialog).
    const selectorLine = selector
      ? `Selector: \`${selector}\`${exportAs ? ` · exportAs: \`${exportAs}\`` : ''}`
      : kind === 'directive'
        ? 'No selector: base class, extend it instead of using it in a template.'
        : 'No selector: not used in a template, created from code (a route, a dialog, `ViewContainerRef.createComponent()`).';
    lines.push(...header(name, kind, doc, ctx, [selectorLine]));
    lines.push(...memberList('Inputs', 'input', inputs));
    lines.push(...memberList('Outputs', 'output', outputs));
    lines.push(...memberList('Two-way bindings (model)', 'model', models, 'Each one also works as `[name]` + `(nameChange)`.'));
    if (directives.length) {
      lines.push(
        '',
        '## Host directives',
        'Applied to every instance. Only the bindings listed here can be used in templates.',
        '',
        ...directives.map((d) => hostDirectiveLine(d, ctx.page, owners)),
      );
    }
    if (kind === 'component') {
      const s = slots(name, cls, meta);
      if (s.length) lines.push('', '## Content projection (ng-content)', ...s.map((x) => `- \`${x}\``));
    }
    // Only methods WITH a JSDoc description: undocumented public methods are usually template handlers.
    const methods = documentedMethods(cls, hidden);
    if (methods.length) lines.push('', '## Public methods (via viewChild or exportAs)', ...methods);

    // Documentation completeness checks (fail the run in --strict mode). The class description is
    // checked with the page. An inherited or exposed binding is reported on the page of the class that
    // declares it, or here if that class has no page (not exported). Another package's docs are not checked.
    const undocumented = (list: Member[], what: string) => {
      for (const m of list) {
        const origin = m.fromHostDirective ?? m.inheritedFrom;
        if (m.description || (origin && (owners.has(origin) || origin.getSourceFile().isInNodeModules()))) continue;
        warn(`${name}.${m.name}: undocumented ${what}${origin ? ` (declared by ${origin.getName()})` : ''}`, m.decl ?? cls);
      }
    };
    undocumented(inputs.concat(models), 'input');
    undocumented(outputs, 'output');
  } else if (kind === 'pipe') {
    // --- Pipes: template name and transform() signature
    const nameNode = propOf(meta, 'name');
    pipeName = str(nameNode);
    if (!pipeName) warn(`${name}: pipe name is not a string literal, its template usage is not documented`, nameNode ?? cls);
    lines.push(...header(name, kind, doc, ctx, pipeName ? [`Template usage: \`{{ value | ${pipeName} }}\``] : []));
    const transform = cls.getMethod('transform');
    if (transform) {
      hidden.scan(...overloadsOf(transform));
      lines.push('', '## Signature', codeBlock('ts', signature('transform', transform).join('\n')), ...paramSection(readFnDoc(transform)));
    }
  } else {
    // --- Services, NgModules and plain classes: public members
    // How it is provided: `providedIn` for @Injectable, `autoProvided` for @Service.
    const provided = ['providedIn', 'autoProvided'].flatMap((p) => {
      const value = propOf(meta, p)?.getText();
      return value ? [`${p}: ${value}`] : [];
    });
    lines.push(...header(name, kind, doc, ctx, provided));
    if (kind === 'module') lines.push(...moduleExports(name, meta, ctx, lib));
    if (kind === 'class') lines.push(...constructorSection(name, cls, hidden));
    lines.push(...memberSections(name, cls, lib, hidden));
  }

  lines.push(...examples(doc));
  hidden.report(name, cls);
  return { name, kind, doc, ep: ctx.ep, page: ctx.page, selector, pipeName, markdown: lines.join('\n') };
}

/**
 * Classes listed in the `exports` of an NgModule: what the templates of an importing component can use.
 * Followed through spreads and constants holding arrays: `exports: [...FX_BUTTONS, CommonModule]`.
 */
function exportedClasses(name: string, list: Node): ClassDeclaration[] {
  const found: ClassDeclaration[] = [];
  const visit = (n: Node, depth: number): void => {
    let e = n;
    while (Node.isSpreadElement(e) || Node.isAsExpression(e) || Node.isSatisfiesExpression(e) || Node.isParenthesizedExpression(e)) {
      e = e.getExpression();
    }
    if (Node.isArrayLiteralExpression(e)) return e.getElements().forEach((x) => visit(x, depth + 1));
    const symbol = e.getSymbol();
    const decl = (symbol?.isAlias() ? symbol.getAliasedSymbol() : symbol)?.getDeclarations()[0];
    const init = decl && Node.isVariableDeclaration(decl) ? decl.getInitializer() : undefined;
    if (decl && Node.isClassDeclaration(decl)) found.push(decl);
    else if (init && depth < 8) visit(init, depth + 1);
    else warn(`${name}: \`exports\` entry \`${oneLine(e.getText())}\` not resolved, not documented`, e);
  };
  visit(list, 0);
  return found;
}

/** "Exports" section of an NgModule page: each class linked to its page, with its selector or pipe name. */
function moduleExports(name: string, meta: ObjectLiteralExpression | undefined, ctx: Context, { root, owners }: Library): string[] {
  const list = propOf(meta, 'exports');
  const lines = (list ? exportedClasses(name, list) : []).map((c) => {
    const external = c.getSourceFile().isInNodeModules();
    const cName = c.getName() ?? '(anonymous)';
    if (!external && !owners.has(c)) {
      const file = toPosix(relative(root, resolve(c.getSourceFile().getFilePath())));
      warn(`${name}: exports ${cName} (${file}), which has no page: export it from an entry point`, list);
    }
    const cMeta = metadata(ngDecorator(c));
    const selector = str(propOf(cMeta, 'selector'));
    const pipe = ngDecorator(c)?.getName() === 'Pipe' ? str(propOf(cMeta, 'name')) : undefined;
    const link = classLink({ name: cName, decl: c, pkg: external ? packageOf(c.getSourceFile().getFilePath()) : undefined }, ctx.page, owners);
    return `- ${link}${selector ? ` \`${selector}\`` : ''}${pipe ? ` \`| ${pipe}\`` : ''}`;
  });
  return lines.length ? ['', '## Exports', 'Usable in the templates of the components that import this module.', '', ...lines] : [];
}

/**
 * Kind of an exported declaration, undefined for the ones not documented (namespaces, etc.).
 * Decorators are gone from a .d.ts of another package: there, Angular classes are recognized by the
 * static declaration the compiler adds (ɵcmp, ɵdir, ɵpipe, ɵprov, ɵmod).
 */
function kindOf(decl: Node): Kind | undefined {
  if (Node.isClassDeclaration(decl)) {
    if (!decl.getSourceFile().isInNodeModules()) return NG_DECORATORS[ngDecorator(decl)?.getName() ?? ''] ?? 'class';
    const has = (p: string) => !!decl.getStaticProperty(p);
    if (has('ɵmod')) return 'module';
    return has('ɵcmp') ? 'component' : has('ɵdir') ? 'directive' : has('ɵpipe') ? 'pipe' : has('ɵprov') ? 'service' : 'class';
  }
  if (Node.isInterfaceDeclaration(decl)) return 'interface';
  if (Node.isTypeAliasDeclaration(decl)) return 'type';
  if (Node.isEnumDeclaration(decl)) return 'enum';
  if (Node.isFunctionDeclaration(decl)) return 'function';
  // `export const f = () => ...` is a function for the consumer: documented and indexed as one.
  if (Node.isVariableDeclaration(decl)) return functionInitializer(decl) ? 'function' : 'const';
  return undefined;
}

/**
 * A symbol the library re-exports from another package (`export { booleanAttribute } from '@angular/core'`).
 * Short page: the import path to use, and where the full documentation lives. Its own JSDoc is not
 * copied: it belongs to the other package and can be long.
 */
function describeExternal(name: string, kind: Kind, decl: Node, ctx: Context): Entry {
  const pkg = packageOf(decl.getSourceFile().getFilePath());
  const doc: Doc = { usage: [], avoid: [], replaces: [], examples: [], params: [], description: `Re-exported from \`${pkg}\`.` };
  const markdown = [...header(name, kind, doc, ctx), '', `See the documentation of \`${pkg}\` for its API.`].join('\n');
  return { name, kind, doc, ep: ctx.ep, page: ctx.page, markdown };
}

/**
 * Named type the consumer cannot look up: an alias or interface of the library that has no page.
 * `const isOdd: FxCheck<number>` alone does not tell how to call `isOdd`.
 */
function isHidden(t: Type, owners: Owners): boolean {
  const decls = (t.getAliasSymbol() ?? t.getSymbol())
    ?.getDeclarations()
    .filter((d) => Node.isTypeAliasDeclaration(d) || Node.isInterfaceDeclaration(d)) ?? []; // not an inline type
  return decls.length > 0 && !decls.some((d) => owners.has(d) || d.getSourceFile().isInNodeModules());
}

/** Any exported declaration. Non-class symbols are shown as their source or signature in a code block. */
export function describe(name: string, decl: Node, ctx: Context, lib: Library): Entry | undefined {
  const kind = kindOf(decl);
  if (!kind) return undefined;
  if (decl.getSourceFile().isInNodeModules()) return describeExternal(name, kind, decl, ctx);
  if (Node.isClassDeclaration(decl)) return describeClass(name, kind, decl, ctx, lib);

  const hidden = new HiddenTypes(lib);
  const doc = Node.isFunctionDeclaration(decl) ? readFnDoc(decl) : readDoc(decl);
  let body: string;
  if (Node.isFunctionDeclaration(decl)) {
    body = signature(name, decl).join('\n');
    hidden.scan(...overloadsOf(decl));
  } else if (Node.isVariableDeclaration(decl)) {
    // A function typed on its variable (`authGuard: CanActivateFn = ...`) keeps that type, as in the .d.ts:
    // the alias name tells what the function is for, and the arrow's inferred signature can be narrower.
    const fn = functionInitializer(decl);
    const typed = !!decl.getTypeNode();
    // `export let` is a live binding the consumer cannot assign: shown as declared all the same.
    const keyword = decl.getVariableStatement()?.getDeclarationKind() ?? 'const';
    body = fn && !typed ? signature(name, fn).join('\n') : `${keyword} ${name}: ${typeText(decl.getType(), decl)};`;
    if (fn && typed && isHidden(decl.getType(), lib.owners)) {
      // The signature shown below the hidden alias is what the agent reads: the alias is not reported.
      body += '\n' + callSignatures(name, decl.getType(), decl).join('\n');
      hidden.scan(fn);
    } else hidden.scan(decl);
  } else {
    body = decl.getText(); // interface, type alias, enum
    hidden.scan(decl);
  }
  hidden.report(name, decl);

  const params = Node.isFunctionDeclaration(decl) || Node.isVariableDeclaration(decl) ? paramSection(doc) : [];
  const markdown = [...header(name, kind, doc, ctx), '', codeBlock('ts', body), ...params, ...examples(doc)].join('\n');
  return { name, kind, doc, ep: ctx.ep, page: ctx.page, markdown };
}
