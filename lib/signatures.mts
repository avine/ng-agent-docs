import {
  type ArrowFunction,
  type ConstructorDeclaration,
  type FunctionDeclaration,
  type FunctionExpression,
  type MethodDeclaration,
  Node,
  type ParameterDeclaration,
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

type Overloadable = MethodDeclaration | FunctionDeclaration | ConstructorDeclaration;
type FunctionLike = Overloadable | ArrowFunction | FunctionExpression;

// For an overloaded function, method or constructor, the implementation (it knows every overload).
const implementationOf = <T extends Overloadable>(fn: T): T =>
  fn.isOverload() ? ((fn.getImplementation() as T | undefined) ?? fn) : fn;

/**
 * JSDoc of a function, method or constructor. With overloads, it is usually written on the first
 * overload, not on the implementation: read the implementation's, otherwise the first overload's.
 */
export function readFnDoc(fn: Overloadable): Doc {
  const impl = implementationOf(fn);
  const first = impl.getOverloads()[0];
  return impl.getJsDocs().length || !first ? readDoc(impl) : readDoc(first);
}

// The signatures a consumer can call: the overloads, otherwise the function itself. Only declarations can
// have overloads; arrow functions and function expressions have one signature.
export function overloadsOf(fn: FunctionLike): FunctionLike[] {
  const declared =
    Node.isMethodDeclaration(fn) ||
    Node.isFunctionDeclaration(fn) ||
    Node.isConstructorDeclaration(fn)
      ? (implementationOf(fn).getOverloads() as FunctionLike[])
      : [];
  return declared.length ? declared : [fn];
}

// Type of a parameter as printed. Prefer the declared type: `x?: string` is `string`, not `string | undefined`.
const paramType = (p: ParameterDeclaration) => p.getTypeNode()?.getType() ?? p.getType();

/**
 * One readable signature per overload, e.g. `show(message: string, durationMs?: number): void`.
 * A constructor gives `new FxDialogRef(id: string)`: `name` is then the class name.
 */
export function signature(name: string, fn: FunctionLike): string[] {
  return overloadsOf(fn).map((s) => {
    // Generic parameters, as written in the source: <T>, <T extends object = {}>
    const generics = Node.isConstructorDeclaration(s)
      ? []
      : s.getTypeParameters().map((t) => t.getText());
    const typeParams = generics.length ? `<${generics.join(', ')}>` : '';
    const params = s.getParameters().map((p) => {
      const rest = p.isRestParameter();
      // A rest parameter is always optional: `...xs?` would be invalid TypeScript.
      const optional = p.isOptional() && !rest ? '?' : '';
      return `${rest ? '...' : ''}${p.getName()}${optional}: ${typeText(paramType(p), p)}`;
    });
    if (Node.isConstructorDeclaration(s)) return `new ${name}(${params.join(', ')})`;
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
export function functionInitializer(
  decl: VariableDeclaration,
): ArrowFunction | FunctionExpression | undefined {
  let init = decl.getInitializer();
  while (init && (Node.isParenthesizedExpression(init) || Node.isSatisfiesExpression(init))) {
    init = init.getExpression();
  }
  return init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init)) ? init : undefined;
}
