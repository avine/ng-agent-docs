import { relative, resolve } from 'node:path';
import {
  type ClassDeclaration,
  type EnumDeclaration,
  type InterfaceDeclaration,
  Node,
  type Symbol as MorphSymbol,
  type Type,
  type TypeAliasDeclaration,
} from 'ts-morph';
import { type Library, warn } from './model.mts';
import { isInside, toPosix } from './util.mts';

// =============================================================================
// Hidden types: library types a page shows by name, but that have no page
// =============================================================================
type Named = InterfaceDeclaration | TypeAliasDeclaration | ClassDeclaration | EnumDeclaration;

// Recursion limit for the inline types of a page (object literals within object literals…).
const MAX_DEPTH = 8;

/** The named declaration behind a symbol: an interface, alias, class or enum (an enum member gives its enum). */
function namedDeclarations(symbol: MorphSymbol): Named[] {
  return symbol.getDeclarations().flatMap((d) => {
    const n = Node.isEnumMember(d) ? d.getParent() : d;
    const named =
      Node.isInterfaceDeclaration(n) || Node.isTypeAliasDeclaration(n) || Node.isClassDeclaration(n) || Node.isEnumDeclaration(n);
    return named ? [n] : [];
  });
}

/**
 * Collects the hidden types of one page: a named type of the library (declared under --root) that has no
 * page. `add(opts: AddOptions)` cannot be used if `AddOptions` is never shown. Types of other packages
 * are not checked: their own docs describe them.
 */
export class HiddenTypes {
  private readonly found = new Set<Named>();
  private readonly seen = new Set<unknown>(); // compiler types already walked
  private readonly lib: Library;

  constructor(lib: Library) {
    this.lib = lib;
  }

  /** Checks a symbol a page shows by name. Returns whether it is a named type (printed by its name). */
  private check(symbol: MorphSymbol | undefined): boolean {
    const decls = symbol ? namedDeclarations(symbol.isAlias() ? symbol.getAliasedSymbol() ?? symbol : symbol) : [];
    const inLibrary = decls.filter((d) => isInside(resolve(d.getSourceFile().getFilePath()), this.lib.root));
    if (inLibrary.length && !decls.some((d) => this.lib.owners.has(d))) this.found.add(inLibrary[0]!);
    return decls.length > 0;
  }

  /**
   * A type the page prints, as `typeText()` prints it: named types by their name (with their type
   * arguments), inline types (unions, object literals, function types) expanded.
   */
  type(t: Type | undefined, at: Node, depth = 0): this {
    if (!t || depth > MAX_DEPTH || this.seen.has(t.compilerType)) return this;
    this.seen.add(t.compilerType);
    const next = (x: Type | undefined) => this.type(x, at, depth + 1);
    if (t.getAliasSymbol()) {
      this.check(t.getAliasSymbol());
      t.getAliasTypeArguments().forEach(next);
      return this;
    }
    if (t.isTypeParameter()) return this;
    if (this.check(t.getSymbol())) {
      t.getTypeArguments().forEach(next);
      return this;
    }
    if (t.isUnion()) t.getUnionTypes().forEach(next);
    else if (t.isIntersection()) t.getIntersectionTypes().forEach(next);
    else if (t.isTuple()) t.getTupleElements().forEach(next);
    else if (t.isObject()) {
      // Inline object or function type: printed member by member.
      t.getTypeArguments().forEach(next); // arrays (Array<T> has no symbol here when anonymous)
      for (const s of [...t.getCallSignatures(), ...t.getConstructSignatures()]) {
        for (const p of s.getParameters()) next(p.getTypeAtLocation(at));
        next(s.getReturnType());
      }
      for (const p of t.getProperties()) next(p.getTypeAtLocation(at));
    }
    return this;
  }

  /** Type references written in source code the page shows as is: an interface, a type alias, generics. */
  source(node: Node | undefined): this {
    for (const n of node ? [node, ...node.getDescendants()] : []) {
      const ref = Node.isTypeReference(n) ? n.getTypeName() : Node.isExpressionWithTypeArguments(n) ? n.getExpression() : undefined;
      const id = ref && Node.isQualifiedName(ref) ? ref.getRight() : ref && Node.isPropertyAccessExpression(ref) ? ref.getNameNode() : ref;
      this.check(id?.getSymbol());
    }
    return this;
  }

  /** One warning per hidden type, at the declaration whose page shows it. */
  report(name: string, at: Node): void {
    for (const d of this.found) {
      const file = toPosix(relative(this.lib.root, d.getSourceFile().getFilePath()));
      warn(`${name}: shows the type ${d.getName() ?? '(anonymous)'} (${file}), which has no page: export it from an entry point`, at);
    }
  }
}
