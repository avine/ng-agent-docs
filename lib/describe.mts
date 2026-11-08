import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { type ClassDeclaration, Node, type ObjectLiteralExpression, Scope, type Type } from 'ts-morph';
import { fullBindings } from './host-directives.mts';
import { readDoc } from './jsdoc.mts';
import { examples, header, hostDirectiveLine, memberList } from './markdown.mts';
import { type Context, type Doc, type Entry, type Kind, type Member, NG_DECORATORS, type Owners, warnings } from './model.mts';
import { callSignatures, functionInitializer, readFnDoc, signature } from './signatures.mts';
import { code, codeBlock, firstParagraph, isPublic, metadata, ngDecorator, packageOf, propOf, str, typeText } from './util.mts';

// =============================================================================
// Symbol description — one function per kind of export
// =============================================================================
// Lifecycle hooks are public but are not part of the API a consumer calls.
const LIFECYCLE = /^ng(OnInit|OnChanges|DoCheck|AfterContentInit|AfterContentChecked|AfterViewInit|AfterViewChecked|OnDestroy)$/;

/**
 * Lists the content projection slots of a component by scanning its template for <ng-content>.
 * Reads the inline `template` or the `templateUrl` file. A slot without `select` is reported as "default", listed first.
 */
function slots(cls: ClassDeclaration, meta?: ObjectLiteralExpression): string[] {
  let html = str(propOf(meta, 'template'));
  const url = str(propOf(meta, 'templateUrl'));
  if (!html && url) {
    const file = resolve(dirname(cls.getSourceFile().getFilePath()), url);
    if (existsSync(file)) html = readFileSync(file, 'utf8');
  }
  if (!html) return [];
  html = html.replace(/<!--[\s\S]*?-->/g, ''); // a commented-out <ng-content> is not a slot
  const found = [...html.matchAll(/<ng-content\b([^>]*)>/g)].map(
    (m) => /select\s*=\s*["']([^"']+)["']/.exec(m[1] ?? '')?.[1] ?? 'default',
  );
  // "default" first, the named slots keep their template order (sort is stable)
  return [...new Set(found)].sort((a, b) => Number(b === 'default') - Number(a === 'default'));
}

/** Classes: components, directives, pipes, services, or plain classes, based on their Angular decorator. */
function describeClass(name: string, kind: Kind, cls: ClassDeclaration, ctx: Context, owners: Owners): Entry {
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
        const d = readFnDoc(m).description;
        return d ? signature(m.getName(), m).map((s) => `- ${code(s)} — ${firstParagraph(d)}`) : [];
      });
    if (methods.length) lines.push('', '## Public methods (via viewChild or exportAs)', ...methods);

    // Documentation completeness checks (fail the run in --strict mode). The class description is
    // checked with the page. An inherited or exposed binding is reported on the page of the class that
    // declares it, or here if that class has no page (not exported). Another package's docs are not checked.
    const undocumented = (list: Member[], what: string) => {
      for (const m of list) {
        const origin = m.fromHostDirective ?? m.inheritedFrom;
        if (m.description || (origin && (owners.has(origin) || origin.getSourceFile().isInNodeModules()))) continue;
        warnings.push(`${name}.${m.name}: undocumented ${what}${origin ? ` (declared by ${origin.getName()})` : ''}`);
      }
    };
    undocumented(inputs.concat(models), 'input');
    undocumented(outputs, 'output');
  } else if (kind === 'pipe') {
    // --- Pipes: template name and transform() signature
    pipeName = str(propOf(meta, 'name'));
    lines.push(...header(name, kind, doc, ctx, [`Template usage: \`{{ value | ${pipeName} }}\``]));
    const transform = cls.getMethod('transform');
    if (transform) lines.push('', '## Signature', codeBlock('ts', signature('transform', transform).join('\n')));
  } else {
    // --- Services and plain classes: all public properties and methods
    // How it is provided: `providedIn` for @Injectable, `autoProvided` for @Service.
    const provided = ['providedIn', 'autoProvided'].flatMap((p) => {
      const value = propOf(meta, p)?.getText();
      return value ? [`${p}: ${value}`] : [];
    });
    lines.push(...header(name, kind, doc, ctx, provided));
    const props = [...cls.getProperties(), ...cls.getGetAccessors()].filter(isPublic).map((p) => {
      const readonly = Node.isPropertyDeclaration(p) && p.isReadonly() ? 'readonly ' : '';
      const type = Node.isGetAccessorDeclaration(p) ? p.getReturnType() : p.getType();
      const d = readDoc(p).description;
      if (!d) warnings.push(`${name}.${p.getName()}: undocumented property`);
      return `- ${code(`${readonly}${p.getName()}: ${typeText(type, p)}`)}${d ? ` — ${firstParagraph(d)}` : ''}`;
    });
    // Public parameter properties: `constructor(public readonly http: HttpClient)` declares a property too.
    // `readonly` alone also makes a public one.
    const ctorProps = (cls.getConstructors()[0]?.getParameters() ?? [])
      .filter((p) => p.isParameterProperty() && p.getScope() === Scope.Public)
      .map((p) => `- ${code(`${p.isReadonly() ? 'readonly ' : ''}${p.getName()}: ${typeText(p.getType(), p)}`)} — constructor parameter`);
    props.push(...ctorProps);
    const methods = cls
      .getMethods()
      .filter((m) => isPublic(m) && !LIFECYCLE.test(m.getName()))
      .flatMap((m) => {
        const d = readFnDoc(m).description;
        if (!d) warnings.push(`${name}.${m.getName()}: undocumented method`);
        return signature(m.getName(), m).map((s) => `- ${code(s)}${d ? ` — ${firstParagraph(d)}` : ''}`);
      });
    if (props.length) lines.push('', '## Properties', ...props);
    if (methods.length) lines.push('', '## Methods', ...methods);
  }

  lines.push(...examples(doc));
  return { name, kind, doc, ep: ctx.ep, page: ctx.page, selector, pipeName, markdown: lines.join('\n') };
}

/**
 * Kind of an exported declaration, undefined for the ones not documented (namespaces, etc.).
 * Decorators are gone from a .d.ts of another package: there, Angular classes are recognized by the
 * static declaration the compiler adds (ɵcmp, ɵdir, ɵpipe, ɵprov).
 */
function kindOf(decl: Node): Kind | undefined {
  if (Node.isClassDeclaration(decl)) {
    if (!decl.getSourceFile().isInNodeModules()) return NG_DECORATORS[ngDecorator(decl)?.getName() ?? ''] ?? 'class';
    const has = (p: string) => !!decl.getStaticProperty(p);
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
  const doc: Doc = { usage: [], avoid: [], replaces: [], examples: [], description: `Re-exported from \`${pkg}\`.` };
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
export function describe(name: string, decl: Node, ctx: Context, owners: Owners): Entry | undefined {
  const kind = kindOf(decl);
  if (!kind) return undefined;
  if (decl.getSourceFile().isInNodeModules()) return describeExternal(name, kind, decl, ctx);
  if (Node.isClassDeclaration(decl)) return describeClass(name, kind, decl, ctx, owners);

  const doc = Node.isFunctionDeclaration(decl) ? readFnDoc(decl) : readDoc(decl);
  let body: string;
  if (Node.isFunctionDeclaration(decl)) body = signature(name, decl).join('\n');
  else if (Node.isVariableDeclaration(decl)) {
    // A function typed on its variable (`authGuard: CanActivateFn = ...`) keeps that type, as in the .d.ts:
    // the alias name tells what the function is for, and the arrow's inferred signature can be narrower.
    const fn = functionInitializer(decl);
    const typed = !!decl.getTypeNode();
    body = fn && !typed ? signature(name, fn).join('\n') : `const ${name}: ${typeText(decl.getType(), decl)};`;
    if (fn && typed && isHidden(decl.getType(), owners)) body += '\n' + callSignatures(name, decl.getType(), decl).join('\n');
  } else body = decl.getText(); // interface, type alias, enum

  const markdown = [...header(name, kind, doc, ctx), '', codeBlock('ts', body), ...examples(doc)].join('\n');
  return { name, kind, doc, ep: ctx.ep, page: ctx.page, markdown };
}
