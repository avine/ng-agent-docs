import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import {
  type ClassDeclaration,
  type GetAccessorDeclaration,
  type MethodDeclaration,
  Node,
  type ObjectLiteralExpression,
  type PropertyDeclaration,
  Scope,
  type Type,
} from 'ts-morph';
import { HiddenTypes } from './hidden-types.mts';
import { fullBindings } from './host-directives.mts';
import { readDoc } from './jsdoc.mts';
import { classLink, examples, header, hostDirectiveLine, memberList, paramItems, paramSection } from './markdown.mts';
import { type Context, type Doc, type Entry, type Kind, type Library, type Member, NG_DECORATORS, type Owners, warn } from './model.mts';
import { callSignatures, callSignatureTypes, functionInitializer, readFnDoc, signature, signatureTypes } from './signatures.mts';
import {
  code,
  codeBlock,
  firstParagraph,
  isPublic,
  isPublicStatic,
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
// Lifecycle hooks are public but are not part of the API a consumer calls.
const LIFECYCLE = /^ng(OnInit|OnChanges|DoCheck|AfterContentInit|AfterContentChecked|AfterViewInit|AfterViewChecked|OnDestroy)$/;

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

/** Slots of a component: from its inline `template`, or its `templateUrl` file. */
function slots(cls: ClassDeclaration, meta?: ObjectLiteralExpression): string[] {
  let html = str(propOf(meta, 'template'));
  const url = str(propOf(meta, 'templateUrl'));
  if (!html && url) {
    const file = resolve(dirname(cls.getSourceFile().getFilePath()), url);
    if (existsSync(file)) html = readFileSync(file, 'utf8');
  }
  return html ? slotsOf(html) : [];
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
    for (const m of [...inputs, ...outputs, ...models]) hidden.type(m.valueType, cls).type(m.acceptsType, cls);
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
      const s = slots(cls, meta);
      if (s.length) lines.push('', '## Content projection (ng-content)', ...s.map((x) => `- \`${x}\``));
    }
    // Only methods WITH a JSDoc description: undocumented public methods are usually template handlers.
    const methods = cls
      .getMethods()
      .filter((m) => isPublic(m) && !LIFECYCLE.test(m.getName()))
      .flatMap((m) => {
        const fnDoc = readFnDoc(m);
        if (!fnDoc.description) return [];
        signatureTypes(m, hidden);
        const lines = signature(m.getName(), m).map((s) => `- ${code(s)} — ${firstParagraph(fnDoc.description)}`);
        return [...lines, ...paramItems(fnDoc)];
      });
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
      signatureTypes(transform, hidden);
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
    lines.push(...memberSections(name, cls, hidden));
  }

  lines.push(...examples(doc));
  hidden.report(name, cls);
  return { name, kind, doc, ep: ctx.ep, page: ctx.page, selector, pipeName, markdown: lines.join('\n') };
}

/**
 * Public members of a service, NgModule or plain class: instance properties and methods, then static ones
 * (`static forRoot()` of an NgModule, the factory methods of a class). Lifecycle hooks are left out.
 */
function memberSections(name: string, cls: ClassDeclaration, hidden: HiddenTypes): string[] {
  type Prop = PropertyDeclaration | GetAccessorDeclaration;
  const property = (p: Prop, isStatic: boolean) => {
    // A getter without a setter is read-only for the consumer.
    const readonly =
      (Node.isPropertyDeclaration(p) && p.isReadonly()) || (Node.isGetAccessorDeclaration(p) && !p.getSetAccessor());
    const type = Node.isGetAccessorDeclaration(p) ? p.getReturnType() : p.getType();
    hidden.type(type, p);
    const d = readDoc(p).description;
    if (!d) warn(`${name}.${p.getName()}: undocumented ${isStatic ? 'static ' : ''}property`, p);
    const text = `${isStatic ? 'static ' : ''}${readonly ? 'readonly ' : ''}${p.getName()}: ${typeText(type, p)}`;
    return `- ${code(text)}${d ? ` — ${firstParagraph(d)}` : ''}`;
  };
  const method = (m: MethodDeclaration, isStatic: boolean) => {
    const fnDoc = readFnDoc(m);
    const d = fnDoc.description;
    if (!d) warn(`${name}.${m.getName()}: undocumented ${isStatic ? 'static ' : ''}method`, m);
    signatureTypes(m, hidden);
    const lines = signature(`${isStatic ? 'static ' : ''}${m.getName()}`, m).map((s) => `- ${code(s)}${d ? ` — ${firstParagraph(d)}` : ''}`);
    return [...lines, ...paramItems(fnDoc)];
  };
  const props: Prop[] = [...cls.getProperties(), ...cls.getGetAccessors()];
  const methods = cls.getMethods().filter((m) => !LIFECYCLE.test(m.getName()));

  // Public parameter properties: `constructor(public readonly http: HttpClient)` declares a property too.
  // `readonly` alone also makes a public one.
  const ctorProps = (cls.getConstructors()[0]?.getParameters() ?? [])
    .filter((p) => p.isParameterProperty() && p.getScope() === Scope.Public)
    .map((p) => {
      hidden.type(p.getType(), p);
      return `- ${code(`${p.isReadonly() ? 'readonly ' : ''}${p.getName()}: ${typeText(p.getType(), p)}`)} — constructor parameter`;
    });
  const instance = [...props.filter(isPublic).map((p) => property(p, false)), ...ctorProps];
  const instanceMethods = methods.filter(isPublic).flatMap((m) => method(m, false));
  const statics = [
    ...props.filter(isPublicStatic).map((p) => property(p, true)),
    ...methods.filter(isPublicStatic).flatMap((m) => method(m, true)),
  ];
  return [
    ...(instance.length ? ['', '## Properties', ...instance] : []),
    ...(instanceMethods.length ? ['', '## Methods', ...instanceMethods] : []),
    ...(statics.length ? ['', `## Static members (\`${name}.member\`)`, ...statics] : []),
  ];
}

/**
 * Constructor of a plain class, the one way to create it: `new FxDialogRef(id: string)`. A constructor
 * that is not public is noted: the consumer gets instances some other way.
 */
function constructorSection(name: string, cls: ClassDeclaration, hidden: HiddenTypes): string[] {
  const ctor = cls.getConstructors()[0];
  if (!ctor || cls.isAbstract()) return [];
  if (ctor.getScope() !== Scope.Public) {
    return ['', '## Constructor', `${ctor.getScope()}: \`new ${name}()\` is not available, instances come from the library.`];
  }
  const fnDoc = readFnDoc(ctor);
  signatureTypes(ctor, hidden);
  const lines = signature(name, ctor).map((s) => `- ${code(s)}${fnDoc.description ? ` — ${firstParagraph(fnDoc.description)}` : ''}`);
  return ['', '## Constructor', ...lines, ...paramItems(fnDoc)];
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
    signatureTypes(decl, hidden);
  } else if (Node.isVariableDeclaration(decl)) {
    // A function typed on its variable (`authGuard: CanActivateFn = ...`) keeps that type, as in the .d.ts:
    // the alias name tells what the function is for, and the arrow's inferred signature can be narrower.
    const fn = functionInitializer(decl);
    const typed = !!decl.getTypeNode();
    // `export let` is a live binding the consumer cannot assign: shown as declared all the same.
    const keyword = decl.getVariableStatement()?.getDeclarationKind() ?? 'const';
    body = fn && !typed ? signature(name, fn).join('\n') : `${keyword} ${name}: ${typeText(decl.getType(), decl)};`;
    if (fn && !typed) signatureTypes(fn, hidden);
    else if (fn && isHidden(decl.getType(), lib.owners)) {
      // The signature shown below the hidden alias is what the agent reads: check its types, not the alias.
      body += '\n' + callSignatures(name, decl.getType(), decl).join('\n');
      callSignatureTypes(decl.getType(), decl, hidden);
    } else hidden.type(decl.getType(), decl);
  } else {
    body = decl.getText(); // interface, type alias, enum
    hidden.source(decl);
  }
  hidden.report(name, decl);

  const params = Node.isFunctionDeclaration(decl) || Node.isVariableDeclaration(decl) ? paramSection(doc) : [];
  const markdown = [...header(name, kind, doc, ctx), '', codeBlock('ts', body), ...params, ...examples(doc)].join('\n');
  return { name, kind, doc, ep: ctx.ep, page: ctx.page, markdown };
}
