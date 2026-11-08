import {
  type ArrowFunction,
  type FunctionDeclaration,
  type FunctionExpression,
  type MethodDeclaration,
  Node,
  type Type,
  type VariableDeclaration,
} from 'ts-morph';
import { readDoc } from './jsdoc.mts';
import type { Doc } from './model.mts';
import { TYPE_FORMAT, typeText } from './util.mts';

// =============================================================================
// Type and signature helpers
// =============================================================================
/**
 * Unwraps the value type of a signal or emitter property:
 * InputSignal<T>, ModelSignal<T>, OutputEmitterRef<T>, EventEmitter<T> → T
 */
export function unwrap(t: Type): Type {
  return t.getTypeArguments()[0] ?? t.getAliasTypeArguments()[0] ?? t;
}

type FunctionLike = MethodDeclaration | FunctionDeclaration | ArrowFunction | FunctionExpression;

// For an overloaded function or method, the implementation (it knows every overload).
const implementationOf = <T extends MethodDeclaration | FunctionDeclaration>(fn: T): T =>
  fn.isOverload() ? ((fn.getImplementation() as T | undefined) ?? fn) : fn;

/**
 * JSDoc of a function or method. With overloads, it is usually written on the first overload,
 * not on the implementation: read the implementation's, otherwise the first overload's.
 */
export function readFnDoc(fn: MethodDeclaration | FunctionDeclaration): Doc {
  const impl = implementationOf(fn);
  const first = impl.getOverloads()[0];
  return impl.getJsDocs().length || !first ? readDoc(impl) : readDoc(first);
}

/** One readable signature per overload, e.g. `show(message: string, durationMs?: number): void`. */
export function signature(name: string, fn: FunctionLike): string[] {
  // Only declarations can have overloads; arrow functions and function expressions have one signature.
  const declared =
    Node.isMethodDeclaration(fn) || Node.isFunctionDeclaration(fn) ? implementationOf(fn).getOverloads() : [];
  const overloads: FunctionLike[] = declared.length ? declared : [fn];
  return overloads.map((s) => {
    // Generic parameters, as written in the source: <T>, <T extends object = {}>
    const generics = s.getTypeParameters().map((t) => t.getText());
    const typeParams = generics.length ? `<${generics.join(', ')}>` : '';
    const params = s.getParameters().map((p) => {
      const rest = p.isRestParameter();
      // A rest parameter is always optional: `...xs?` would be invalid TypeScript.
      const optional = p.isOptional() && !rest ? '?' : '';
      // Prefer the declared type: `x?: string` is printed as `string`, not `string | undefined`.
      const type = p.getTypeNode()?.getType() ?? p.getType();
      return `${rest ? '...' : ''}${p.getName()}${optional}: ${typeText(type, p)}`;
    });
    return `${name}${typeParams}(${params.join(', ')}): ${typeText(s.getReturnType(), s)}`;
  });
}

/** Call signatures of a function type, its type arguments applied: `FxCheck<number>` → `isOdd(value: number): boolean`. */
export const callSignatures = (name: string, t: Type, at: Node) =>
  t.getCallSignatures().map((s) => {
    const checker = at.getProject().getTypeChecker().compilerObject;
    return name + checker.signatureToString(s.compilerSignature, at.compilerNode, TYPE_FORMAT);
  });

/**
 * Function assigned to a const: `export const f = (...) => ...` or `export const f = function (...) {...}`.
 * Looks through parentheses and `satisfies`, not `as`: consumers see the asserted type, so `f = (...) as Fn`
 * is documented as `const f: Fn`. Returns undefined for any other initializer.
 */
export function functionInitializer(decl: VariableDeclaration): ArrowFunction | FunctionExpression | undefined {
  let init = decl.getInitializer();
  while (init && (Node.isParenthesizedExpression(init) || Node.isSatisfiesExpression(init))) {
    init = init.getExpression();
  }
  return init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init)) ? init : undefined;
}
