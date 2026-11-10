import { relative, resolve } from 'node:path';
import {
  type ClassDeclaration,
  type EnumDeclaration,
  type InterfaceDeclaration,
  Node,
  type TypeAliasDeclaration,
} from 'ts-morph';
import { type Library, warn } from './model.mts';
import { isInside, toPosix } from './util.mts';

// =============================================================================
// Hidden types: library types a page shows by name, but that have no page
// =============================================================================
type Named = InterfaceDeclaration | TypeAliasDeclaration | ClassDeclaration | EnumDeclaration;

const isNamed = (n: Node): n is Named =>
  Node.isInterfaceDeclaration(n) ||
  Node.isTypeAliasDeclaration(n) ||
  Node.isClassDeclaration(n) ||
  Node.isEnumDeclaration(n);

// The body of a function, method or accessor: never shown on a page.
const isBody = (n: Node) => {
  const parent = n.getParent();
  return !!parent && (Node.isBodied(parent) || Node.isBodyable(parent)) && parent.getBody() === n;
};

/**
 * Collects the hidden types of one page: a named type of the library (declared under --root) that has no
 * page. `add(opts: AddOptions)` cannot be used if `AddOptions` is never shown. Types of other packages
 * are not checked: their own docs describe them.
 *
 * Only the type references written in the source are read: an inferred type (a return type without
 * annotation) is not checked.
 */
export class HiddenTypes {
  private readonly found = new Set<Named>();
  private readonly lib: Library;

  constructor(lib: Library) {
    this.lib = lib;
  }

  /** Type references written in the nodes a page shows (`x: AddOptions`, `extends Base`), function bodies excepted. */
  scan(...nodes: (Node | undefined)[]): this {
    for (const node of nodes) {
      node?.forEachDescendant((n, traversal) => {
        if (isBody(n)) return traversal.skip();
        const ref = Node.isTypeReference(n)
          ? n.getTypeName()
          : Node.isExpressionWithTypeArguments(n)
            ? n.getExpression()
            : undefined;
        const id =
          ref && Node.isQualifiedName(ref)
            ? ref.getRight()
            : ref && Node.isPropertyAccessExpression(ref)
              ? ref.getNameNode()
              : ref;
        if (id) this.check(id);
      });
    }
    return this;
  }

  // A reference to an enum member (`FxTone.Neutral`) gives its enum.
  private check(id: Node): void {
    const symbol = id.getSymbol();
    const decls =
      (symbol?.isAlias() ? (symbol.getAliasedSymbol() ?? symbol) : symbol)?.getDeclarations() ?? [];
    const named = decls.map((d) => (Node.isEnumMember(d) ? d.getParent() : d)).filter(isNamed);
    const inLibrary = named.filter((d) =>
      isInside(resolve(d.getSourceFile().getFilePath()), this.lib.root),
    );
    if (inLibrary.length && !named.some((d) => this.lib.owners.has(d)))
      this.found.add(inLibrary[0]!);
  }

  /** One warning per hidden type, at the declaration whose page shows it. */
  report(name: string, at: Node): void {
    for (const d of this.found) {
      const file = toPosix(relative(this.lib.root, d.getSourceFile().getFilePath()));
      warn(
        `${name}: shows the type ${d.getName() ?? '(anonymous)'} (${file}), which has no page: export it from an entry point`,
        at,
      );
    }
  }
}
