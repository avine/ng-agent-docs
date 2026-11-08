import {
  type ClassDeclaration,
  type GetAccessorDeclaration,
  type MethodDeclaration,
  Node,
  type ParameterDeclaration,
  type PropertyDeclaration,
  Scope,
} from 'ts-morph';
import type { HiddenTypes } from './hidden-types.mts';
import { readDoc } from './jsdoc.mts';
import { paramItems } from './markdown.mts';
import { type Library, warn } from './model.mts';
import { callSignatures, callSignatureTypes, readFnDoc, signature, signatureTypes } from './signatures.mts';
import { code, firstParagraph, isPublic, isPublicStatic, packageOf, typeText } from './util.mts';

// =============================================================================
// Public members of a class: own and inherited
// =============================================================================
// Lifecycle hooks are public but are not part of the API a consumer calls.
export const LIFECYCLE = /^ng(OnInit|OnChanges|DoCheck|AfterContentInit|AfterContentChecked|AfterViewInit|AfterViewChecked|OnDestroy)$/;

type Prop = PropertyDeclaration | GetAccessorDeclaration;

/** One public member, and the base class that declares it when it is inherited. */
interface ClassMember {
  member: Prop | MethodDeclaration | ParameterDeclaration; // a parameter: `constructor(public readonly x: X)`
  isStatic: boolean;
  base?: ClassDeclaration | undefined;
}

/** Public members declared by one class: properties and getters, constructor parameter properties, methods. */
function ownMembers(c: ClassDeclaration): ClassMember[] {
  const props: Prop[] = [...c.getProperties(), ...c.getGetAccessors()];
  const methods = c.getMethods().filter((m) => !LIFECYCLE.test(m.getName()));
  // `readonly` alone also makes a public parameter property.
  const params = (c.getConstructors()[0]?.getParameters() ?? []).filter((p) => p.isParameterProperty() && p.getScope() === Scope.Public);
  return [
    ...props.filter(isPublic).map((member) => ({ member, isStatic: false })),
    ...params.map((member) => ({ member, isStatic: false })),
    ...methods.filter(isPublic).map((member) => ({ member, isStatic: false })),
    ...props.filter(isPublicStatic).map((member) => ({ member, isStatic: true })),
    ...methods.filter(isPublicStatic).map((member) => ({ member, isStatic: true })),
  ];
}

/**
 * The class, then its base classes in the library, nearest first. The walk stops at the first base class
 * from another package (returned apart: its members are documented by that package) or one that cannot
 * be resolved.
 */
function sourceChain(cls: ClassDeclaration): { chain: ClassDeclaration[]; externalBase?: ClassDeclaration | undefined } {
  const chain = [cls];
  for (let b = cls.getBaseClass(); b && !chain.includes(b); b = b.getBaseClass()) {
    if (b.getSourceFile().isInNodeModules()) return { chain, externalBase: b };
    chain.push(b);
  }
  return { chain };
}

/**
 * Public members of a class, then those it inherits from its base classes in the library, nearest first.
 * A member the class (or a nearer base) declares again hides the inherited one, as in TypeScript.
 */
function classMembers(cls: ClassDeclaration): ClassMember[] {
  const seen = new Set<string>();
  return sourceChain(cls).chain.flatMap((c) =>
    ownMembers(c).flatMap((m) => {
      const key = `${m.isStatic}:${m.member.getName()}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ ...m, base: c === cls ? undefined : c }];
    }),
  );
}

/**
 * Lines of one member, with its description. An inherited member is read through the class, so the
 * base's type parameters are resolved: `FxStoreBase<T>.items: T[]` is `items: FxOption[]` on a subclass of
 * `FxStoreBase<FxOption>`.
 */
function memberLines(cls: ClassDeclaration, { member, isStatic, base }: ClassMember, hidden: HiddenTypes): { lines: string[]; documented: boolean } {
  const name = member.getName();
  const from = base ? ` · inherited from ${base.getName()}` : '';
  const prefix = isStatic ? 'static ' : '';
  // Through the class: its type arguments applied. Static members cannot use the type parameters.
  const resolved = base && !isStatic && base.getTypeParameters().length ? cls.getType().getProperty(name)?.getTypeAtLocation(cls) : undefined;

  if (Node.isMethodDeclaration(member)) {
    const fnDoc = readFnDoc(member);
    const d = fnDoc.description;
    let signatures: string[];
    if (resolved) {
      signatures = callSignatures(`${prefix}${name}`, resolved, cls);
      callSignatureTypes(resolved, cls, hidden);
    } else {
      signatures = signature(`${prefix}${name}`, member);
      signatureTypes(member, hidden);
    }
    const lines = signatures.map((s) => `- ${code(s)}${from}${d ? ` — ${firstParagraph(d)}` : ''}`);
    return { lines: [...lines, ...paramItems(fnDoc)], documented: !!d };
  }
  if (Node.isParameterDeclaration(member)) {
    const type = resolved ?? member.getType();
    hidden.type(type, member);
    const text = `${member.isReadonly() ? 'readonly ' : ''}${name}: ${typeText(type, member)}`;
    return { lines: [`- ${code(text)}${from} — constructor parameter`], documented: true };
  }
  // A getter without a setter is read-only for the consumer.
  const readonly =
    (Node.isPropertyDeclaration(member) && member.isReadonly()) || (Node.isGetAccessorDeclaration(member) && !member.getSetAccessor());
  const type = resolved ?? (Node.isGetAccessorDeclaration(member) ? member.getReturnType() : member.getType());
  hidden.type(type, member);
  const d = readDoc(member).description;
  const text = `${prefix}${readonly ? 'readonly ' : ''}${name}: ${typeText(type, base ? cls : member)}`;
  return { lines: [`- ${code(text)}${from}${d ? ` — ${firstParagraph(d)}` : ''}`], documented: !!d };
}

/**
 * Public members of a service, NgModule or plain class: properties, methods, then static ones (`static
 * forRoot()` of an NgModule, the factory methods of a class), own and inherited. A base class from
 * another package is named, its members are not listed.
 *
 * Completeness check (fails the run in --strict mode): every member needs a description. An inherited one
 * is reported on the page of the class that declares it, or here if that class has no page.
 */
export function memberSections(name: string, cls: ClassDeclaration, lib: Library, hidden: HiddenTypes): string[] {
  const heritage = cls.getExtends();
  if (heritage && !cls.getBaseClass()) {
    warn(`${name}: base class \`${heritage.getText()}\` not resolved, its members are not documented`, heritage);
  }
  const sections = { properties: [] as string[], methods: [] as string[], statics: [] as string[] };
  for (const m of classMembers(cls)) {
    const { lines, documented } = memberLines(cls, m, hidden);
    const what = `${m.isStatic ? 'static ' : ''}${Node.isMethodDeclaration(m.member) ? 'method' : 'property'}`;
    if (!documented && !(m.base && lib.owners.has(m.base))) {
      warn(`${name}.${m.member.getName()}: undocumented ${what}${m.base ? ` (declared by ${m.base.getName()})` : ''}`, m.member);
    }
    (m.isStatic ? sections.statics : Node.isMethodDeclaration(m.member) ? sections.methods : sections.properties).push(...lines);
  }
  const { externalBase } = sourceChain(cls);
  const pkg = externalBase && packageOf(externalBase.getSourceFile().getFilePath());
  return [
    ...(sections.properties.length ? ['', '## Properties', ...sections.properties] : []),
    ...(sections.methods.length ? ['', '## Methods', ...sections.methods] : []),
    ...(sections.statics.length ? ['', `## Static members (\`${name}.member\`)`, ...sections.statics] : []),
    ...(externalBase ? ['', `Also has the public members of ${externalBase.getName()} (\`${pkg}\`), documented by that package.`] : []),
  ];
}

/**
 * Public methods of a component or directive that have a description, own and inherited: undocumented ones
 * are usually template handlers. Called through viewChild or exportAs.
 */
export function documentedMethods(cls: ClassDeclaration, hidden: HiddenTypes): string[] {
  return classMembers(cls)
    .filter((m) => !m.isStatic && Node.isMethodDeclaration(m.member) && readFnDoc(m.member).description)
    .flatMap((m) => memberLines(cls, m, hidden).lines);
}

/**
 * Constructor of a plain class, the one way to create it: `new FxRange(min: number, max?: number)`, its own
 * or the one it inherits. A constructor that is not public is noted: the consumer gets instances some other way.
 */
export function constructorSection(name: string, cls: ClassDeclaration, hidden: HiddenTypes): string[] {
  if (cls.isAbstract()) return [];
  const owner = sourceChain(cls).chain.find((c) => c.getConstructors().length);
  const ctor = owner?.getConstructors()[0];
  if (!owner || !ctor) return [];
  if (ctor.getScope() !== Scope.Public) {
    return ['', '## Constructor', `${ctor.getScope()}: \`new ${name}()\` is not available, instances come from the library.`];
  }
  const fnDoc = readFnDoc(ctor);
  const from = owner === cls ? '' : ` · inherited from ${owner.getName()}`;
  signatureTypes(ctor, hidden);
  const lines = signature(name, ctor).map((s) => `- ${code(s)}${from}${fnDoc.description ? ` — ${firstParagraph(fnDoc.description)}` : ''}`);
  return ['', '## Constructor', ...lines, ...paramItems(fnDoc)];
}
