import {
  type CallExpression,
  type ClassDeclaration,
  type Decorator,
  type GetAccessorDeclaration,
  Node,
  type ObjectLiteralExpression,
  type PropertyDeclaration,
  type SetAccessorDeclaration,
  SyntaxKind,
} from 'ts-morph';
import { readDoc } from './jsdoc.mts';
import { type Bindings, type Member, warn } from './model.mts';
import { unwrap } from './signatures.mts';
import { metadata, ngDecorator, oneLine, propOf, str, typeText } from './util.mts';

// =============================================================================
// Angular bindings: inputs, outputs, models
// =============================================================================
// Signal-based binding functions recognized in property initializers.
const SIGNAL_FNS = new Set(['input', 'model', 'output', 'outputFromObservable']);

// Class member a binding is declared on: a property, or a setter or getter.
const memberOf = (cls: ClassDeclaration, prop: string) =>
  cls.getProperty(prop) ?? cls.getSetAccessor(prop) ?? cls.getGetAccessor(prop);

/**
 * Type of a binding, read from its class member: a setter accepts its parameter's type, a getter gives
 * its return type, a property its own type, unwrapped (InputSignal<T>, EventEmitter<T> → T) when `wrapped`.
 */
function memberType(member: Node | undefined, wrapped: boolean): string {
  if (!member) return 'unknown';
  if (Node.isSetAccessorDeclaration(member)) {
    return typeText(member.getParameters()[0]?.getType() ?? member.getType(), member);
  }
  if (Node.isGetAccessorDeclaration(member)) return typeText(member.getReturnType(), member);
  if (Node.isPropertyDeclaration(member))
    return typeText(wrapped ? unwrap(member.getType()) : member.getType(), member);
  return 'unknown';
}

// Description and deprecation of a binding, from the JSDoc of its class member (none if it is missing).
const docOf = (member: Node | undefined) => {
  const doc = member && readDoc(member);
  return { description: doc?.description, deprecated: doc?.deprecated, decl: member };
};

/**
 * Transform of an input: `booleanAttribute`, `toNumber`, or an inline function. Angular's own transforms
 * are known by name; for one of the library, what it accepts is shown too, from its first parameter:
 * `input(0, { transform: (v: string | number) => Number(v) })` accepts `string | number`.
 */
function transformOf(expr: Node | undefined): Pick<Member, 'transform' | 'accepts'> {
  if (!expr) return {};
  const named = Node.isIdentifier(expr) || Node.isPropertyAccessExpression(expr);
  const symbol = named
    ? expr.getSymbol()?.isAlias()
      ? expr.getSymbol()?.getAliasedSymbol()
      : expr.getSymbol()
    : undefined;
  const external = !!symbol?.getDeclarations().some((d) => d.getSourceFile().isInNodeModules());
  const param = expr.getType().getCallSignatures()[0]?.getParameters()[0];
  if (external || !param) return { transform: oneLine(expr.getText()) };
  return {
    transform: named ? expr.getText() : undefined,
    accepts: typeText(param.getTypeAtLocation(expr), expr),
  };
}

// Default value written in the JSDoc (`@default 10`), for a binding whose default is not in the code.
const docDefault = (member: Node | undefined) =>
  member ? readDoc(member).defaultValue : undefined;

/**
 * Detects a signal-based binding: `x = input(...)`, `input.required(...)`, `model(...)`, `output(...)`.
 * Returns the function name, whether it is `.required`, and the call node (to read its arguments).
 */
function signalCall(p: PropertyDeclaration) {
  const init = p.getInitializer();
  if (!init || !Node.isCallExpression(init)) return undefined;
  const [fn = '', modifier] = init.getExpression().getText().split('.');
  return SIGNAL_FNS.has(fn) ? { fn, required: modifier === 'required', call: init } : undefined;
}

// Options object of a signal binding: `input(0, { alias, transform })` → `{ alias, transform }`.
const signalOptions = (call: CallExpression) =>
  call
    .getArguments()
    .find(
      (a): a is ObjectLiteralExpression =>
        Node.isObjectLiteralExpression(a) &&
        !!(a.getProperty('alias') || a.getProperty('transform')),
    );

/**
 * Describes a decorator-based input, on a property or on a getter/setter:
 *   @Input() x = 1;   @Input('alias') x;   @Input({ alias, required, transform }) x;
 */
function decoratorInput(
  m: PropertyDeclaration | SetAccessorDeclaration | GetAccessorDeclaration,
  d: Decorator,
): Omit<Member, 'description' | 'deprecated' | 'decl'> {
  const arg = d.getArguments()[0];
  const opts = arg && Node.isObjectLiteralExpression(arg) ? arg : undefined;
  return {
    name: str(arg) ?? str(propOf(opts, 'alias')) ?? m.getName(),
    prop: m.getName(),
    wrapped: false,
    type: memberType(m, false),
    ...transformOf(propOf(opts, 'transform')),
    required: propOf(opts, 'required')?.getText() === 'true',
    default:
      (Node.isPropertyDeclaration(m) ? m.getInitializer()?.getText() : undefined) ?? docDefault(m),
  };
}

/** Collects every template binding of a component or directive: signal-based, decorators, and metadata arrays. */
function bindings(cls: ClassDeclaration, meta: ObjectLiteralExpression | undefined): Bindings {
  const inputs: Member[] = [];
  const outputs: Member[] = [];
  const models: Member[] = [];

  for (const p of cls.getProperties()) {
    // 1. Signal-based: input() / input.required() / model() / output() / outputFromObservable()
    const sig = signalCall(p);
    if (sig) {
      const opts = signalOptions(sig.call);
      // The first argument is the default value, unless the binding is required or it's the options object.
      const first = sig.call.getArguments()[0];
      const hasDefault =
        !sig.required && (sig.fn === 'input' || sig.fn === 'model') && first && first !== opts;
      const member: Member = {
        name: str(propOf(opts, 'alias')) ?? p.getName(),
        prop: p.getName(),
        wrapped: true,
        type: memberType(p, true),
        ...transformOf(propOf(opts, 'transform')),
        required: sig.required,
        default:
          (hasDefault ? first.getText() : undefined) ??
          (sig.fn === 'output' ? undefined : docDefault(p)),
        ...docOf(p),
      };
      (sig.fn === 'input' ? inputs : sig.fn === 'model' ? models : outputs).push(member);
      continue;
    }

    // 2. Decorator-based input: @Input()
    const inputDecorator = p.getDecorator('Input');
    if (inputDecorator) {
      inputs.push({ ...decoratorInput(p, inputDecorator), ...docOf(p) });
      continue;
    }

    // 3. Decorator-based output: @Output() x = new EventEmitter<T>()
    const outputDecorator = p.getDecorator('Output');
    if (outputDecorator) {
      outputs.push({
        name: str(outputDecorator.getArguments()[0]) ?? p.getName(),
        prop: p.getName(),
        wrapped: true,
        type: memberType(p, true),
        required: false,
        ...docOf(p),
      });
    }
  }

  // 4. @Input() placed on a setter or a getter
  for (const accessor of [...cls.getSetAccessors(), ...cls.getGetAccessors()]) {
    const d = accessor.getDecorator('Input');
    if (d) inputs.push({ ...decoratorInput(accessor, d), ...docOf(accessor) });
  }

  // 5. Older style, in the decorator metadata: @Component({ inputs: [...], outputs: [...] })
  inputs.push(...metadataBindings(cls, meta, 'inputs'));
  outputs.push(...metadataBindings(cls, meta, 'outputs'));
  return { inputs, outputs, models };
}

/**
 * Own bindings, plus the ones inherited from the `extends` chain, nearest base class first.
 * A member the class (or a nearer base) declares again replaces the inherited one, as in Angular.
 *
 * Inherited types are read through the child's own type, so a generic base is resolved:
 * `class FxDatePicker extends FxFieldBase<Date>` shows `value: Date`, not `value: T`.
 * A base class from another package is read from its .d.ts (see externalBindings). One that can't
 * be resolved stops the walk with a warning: its bindings are not documented.
 */
export function allBindings(
  cls: ClassDeclaration,
  meta: ObjectLiteralExpression | undefined,
): Bindings {
  const result = bindings(cls, meta);
  const groups = [result.inputs, result.outputs, result.models] as const;
  const seen = new Set(groups.flatMap((list) => list.map((m) => m.prop)));
  const visited = new Set<ClassDeclaration>([cls]); // guards against a cycle in broken code

  // `extends withHighlight(CardBase)`: ts-morph resolves the base to CardBase, the mixin's argument,
  // and skips the class the mixin declares. CardBase is still read; the mixin's own bindings are not.
  const checkMixin = (c: ClassDeclaration) => {
    const expr = c.getExtends()?.getExpression();
    if (expr && Node.isCallExpression(expr)) {
      warn(
        `${cls.getName()}: bindings declared by the mixin \`${oneLine(expr.getText())}\` are not documented`,
        expr,
      );
    }
  };
  checkMixin(cls);

  let base = cls.getBaseClass();
  const heritage = cls.getExtends();
  if (!base && heritage) {
    warn(
      `${cls.getName()}: base class \`${heritage.getText()}\` not resolved, its inputs and outputs are not documented`,
      heritage,
    );
  }
  while (base && !visited.has(base)) {
    visited.add(base);
    checkMixin(base);
    const inherited = base.getSourceFile().isInNodeModules()
      ? (externalBindings(base) ?? { inputs: [], outputs: [], models: [] }) // a plain class has none
      : bindings(base, metadata(ngDecorator(base)));
    [inherited.inputs, inherited.outputs, inherited.models].forEach((list, i) => {
      for (const m of list) {
        if (seen.has(m.prop)) continue; // redeclared lower in the chain
        seen.add(m.prop);
        // Read through the child, so the base's type parameters are resolved (`value: T` → `value: Date`),
        // except for a setter that does not use them: it accepts its parameter's type, already in `m.type`,
        // while the child only gives the getter's.
        const setterType = base?.getSetAccessor(m.prop)?.getParameters()[0]?.getTypeNode();
        const typeParams = new Set(base?.getTypeParameters().map((p) => p.getName()));
        const keepOwn =
          setterType &&
          !setterType
            .getDescendantsOfKind(SyntaxKind.Identifier)
            .some((id) => typeParams.has(id.getText()));
        const t = keepOwn ? undefined : cls.getType().getProperty(m.prop)?.getTypeAtLocation(cls);
        const type = t ? typeText(m.wrapped ? unwrap(t) : t, cls) : m.type;
        groups[i]?.push({ ...m, type, inheritedFrom: base });
      }
    });
    base = base.getBaseClass();
  }
  return result;
}

/**
 * Bindings declared in the `inputs` or `outputs` array of the decorator metadata:
 *   inputs: ['label', 'size: fxSize', { name: 'value', alias: 'fxValue', required: true, transform: booleanAttribute }]
 * In 'size: fxSize', `size` is the class property and `fxSize` the name used in templates.
 * The type, default value and JSDoc come from the class property of the same name.
 */
function metadataBindings(
  cls: ClassDeclaration,
  meta: ObjectLiteralExpression | undefined,
  key: 'inputs' | 'outputs',
): Member[] {
  const list = propOf(meta, key);
  if (!list) return [];
  if (!Node.isArrayLiteralExpression(list)) {
    warn(
      `${cls.getName()}: \`${key}\` metadata is not an array literal, its bindings are not documented`,
      list,
    );
    return [];
  }
  return list.getElements().flatMap((el): Member[] => {
    let prop: string | undefined;
    let alias: string | undefined;
    let required = false;
    let transform: Node | undefined;
    const text = str(el);
    if (text !== undefined) {
      [prop, alias] = text.split(':').map((s) => s.trim());
    } else if (Node.isObjectLiteralExpression(el)) {
      prop = str(propOf(el, 'name'));
      alias = str(propOf(el, 'alias'));
      required = propOf(el, 'required')?.getText() === 'true';
      transform = propOf(el, 'transform');
    }
    if (!prop) {
      warn(
        `${cls.getName()}: \`${key}\` entry \`${oneLine(el.getText())}\` not understood, not documented`,
        el,
      );
      return [];
    }
    const member = memberOf(cls, prop);
    if (!member)
      warn(
        `${cls.getName()}: \`${key}\` entry \`${prop}\` has no matching class property (typo?)`,
        el,
      );
    return [
      {
        name: alias || prop,
        prop,
        wrapped: key === 'outputs' && !!member && Node.isPropertyDeclaration(member),
        type: memberType(member, key === 'outputs'), // an output emits T of EventEmitter<T>
        required,
        ...transformOf(transform),
        default:
          key === 'inputs'
            ? ((member && Node.isPropertyDeclaration(member)
                ? member.getInitializer()?.getText()
                : undefined) ?? docDefault(member))
            : undefined,
        ...docOf(member),
        decl: member ?? el, // a warning about it points to the class member, or to the entry if there is none
      },
    ];
  });
}

// Value of a literal type in a .d.ts: "class" → class, true → true.
const literalType = (n?: Node) => {
  if (!n || !Node.isLiteralTypeNode(n)) return undefined;
  const lit = n.getLiteral();
  return Node.isStringLiteral(lit) ? lit.getLiteralText() : lit.getText();
};

/**
 * Bindings of a directive or component from another package. Its decorators are gone from the .d.ts,
 * but the Angular compiler writes them in a static declaration:
 *   static ɵdir: ɵɵDirectiveDeclaration<NgClass, "[ngClass]", never,
 *     { "klass": { "alias": "class"; "required": false; } },   ← inputs (before v16: { "klass": "class" })
 *     { "changed": "ngClassChange" }, ...>                      ← outputs
 * A model appears in both maps: it is recognized by its ModelSignal type.
 */
export function externalBindings(cls: ClassDeclaration): Bindings | undefined {
  const declaration = cls.getStaticProperty('ɵdir') ?? cls.getStaticProperty('ɵcmp');
  const typeNode =
    declaration && Node.isPropertyDeclaration(declaration) ? declaration.getTypeNode() : undefined;
  if (!typeNode || !Node.isTypeReference(typeNode)) return undefined;
  const [, , , inputsNode, outputsNode] = typeNode.getTypeArguments();
  const entries = (n?: Node) =>
    n && Node.isTypeLiteral(n)
      ? n
          .getProperties()
          .map((p) => ({ prop: str(p.getNameNode()) ?? p.getName(), value: p.getTypeNode() }))
      : [];
  const isModel = (m?: Node) => {
    const t = m && Node.isPropertyDeclaration(m) ? m.getType() : undefined;
    return (t?.getAliasSymbol() ?? t?.getSymbol())?.getName() === 'ModelSignal';
  };
  const result: Bindings = { inputs: [], outputs: [], models: [] };
  const modelNames = new Set<string>();

  for (const { prop, value } of entries(inputsNode)) {
    const member = memberOf(cls, prop);
    const options = value && Node.isTypeLiteral(value) ? value : undefined;
    const option = (name: string) => literalType(options?.getProperty(name)?.getTypeNode());
    const name = options ? (option('alias') ?? prop) : (literalType(value) ?? prop);
    const model = isModel(member);
    if (model) modelNames.add(`${name}Change`);
    (model ? result.models : result.inputs).push({
      name,
      prop,
      wrapped: option('isSignal') === 'true' || model,
      type: memberType(member, option('isSignal') === 'true' || model),
      required: option('required') === 'true',
      ...docOf(member),
    });
  }
  for (const { prop, value } of entries(outputsNode)) {
    const name = literalType(value) ?? prop;
    if (modelNames.has(name)) continue; // the `xChange` half of a model
    const member = memberOf(cls, prop);
    result.outputs.push({
      name,
      prop,
      wrapped: true,
      type: memberType(member, true),
      required: false,
      ...docOf(member),
    });
  }
  return result;
}
