import {
  type ArrowFunction,
  type FunctionDeclaration,
  type FunctionExpression,
  type MethodDeclaration,
  Node,
  type ParameterDeclaration,
  type Type,
  type VariableDeclaration,
} from 'ts-morph';
import type { HiddenTypes } from './hidden-types.mts';
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

// The signatures a consumer can call: the overloads, otherwise the function itself. Only declarations can
// have overloads; arrow functions and function expressions have one signature.
function overloadsOf(fn: FunctionLike): FunctionLike[] {
  const declared =
    Node.isMethodDeclaration(fn) || Node.isFunctionDeclaration(fn) ? implementationOf(fn).getOverloads() : [];
  return declared.length ? declared : [fn];
}

// Type of a parameter as printed. Prefer the declared type: `x?: string` is `string`, not `string | undefined`.
const paramType = (p: ParameterDeclaration) => p.getTypeNode()?.getType() ?? p.getType();

/** One readable signature per overload, e.g. `show(message: string, durationMs?: number): void`. */
export function signature(name: string, fn: FunctionLike): string[] {
  return overloadsOf(fn).map((s) => {
    // Generic parameters, as written in the source: <T>, <T extends object = {}>
    const generics = s.getTypeParameters().map((t) => t.getText());
    const typeParams = generics.length ? `<${generics.join(', ')}>` : '';
    const params = s.getParameters().map((p) => {
      const rest = p.isRestParameter();
      // A rest parameter is always optional: `...xs?` would be invalid TypeScript.
      const optional = p.isOptional() && !rest ? '?' : '';
      return `${rest ? '...' : ''}${p.getName()}${optional}: ${typeText(paramType(p), p)}`;
    });
    return `${name}${typeParams}(${params.join(', ')}): ${typeText(s.getReturnType(), s)}`;
  });
}

/** Adds the types `signature()` prints to `hidden`: generic parameters, parameters, return type. */
export function signatureTypes(fn: FunctionLike, hidden: HiddenTypes): void {
  for (const s of overloadsOf(fn)) {
    s.getTypeParameters().forEach((t) => hidden.source(t));
    s.getParameters().forEach((p) => hidden.type(paramType(p), p));
    hidden.type(s.getReturnType(), s);
  }
}

/** Call signatures of a function type, its type arguments applied: `FxCheck<number>` → `isOdd(value: number): boolean`. */
export const callSignatures = (name: string, t: Type, at: Node) =>
  t.getCallSignatures().map((s) => {
    const checker = at.getProject().getTypeChecker().compilerObject;
    return name + checker.signatureToString(s.compilerSignature, at.compilerNode, TYPE_FORMAT);
  });

/** Adds the types `callSignatures()` prints to `hidden`. */
export function callSignatureTypes(t: Type, at: Node, hidden: HiddenTypes): void {
  for (const s of t.getCallSignatures()) {
    s.getParameters().forEach((p) => hidden.type(p.getTypeAtLocation(at), at));
    hidden.type(s.getReturnType(), at);
  }
}

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
