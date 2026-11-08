import { type ClassDeclaration, Node, type ObjectLiteralExpression } from 'ts-morph';
import { allBindings, externalBindings } from './bindings.mts';
import { type BindingKind, type Bindings, type Member, warnings } from './model.mts';
import { metadata, ngDecorator, oneLine, packageOf, propOf, str } from './util.mts';

// =============================================================================
// Host directives
// =============================================================================
/** One entry of `hostDirectives`, for the "Host directives" section of the page. */
export interface HostDirective {
  name: string;
  decl?: ClassDeclaration | undefined;
  pkg?: string | undefined; // set when the directive comes from another package
  exposed: { binding: BindingKind; name: string }[]; // what the host exposes, under its name on the host
}

/** Class a `hostDirectives` entry refers to: `FxTooltip`, or `directive: FxTooltip` in the object form. */
const classOf = (expr: Node) =>
  expr.getType().getSymbol()?.getDeclarations().find((d): d is ClassDeclaration => Node.isClassDeclaration(d));

/**
 * Bindings a class gets from its `hostDirectives`, and the list of those directives.
 *   hostDirectives: [FxRipple, { directive: FxTooltip, inputs: ['fxTooltip: hint'], outputs: ['visibleChange'] }]
 * A bare directive is applied but exposes nothing. In 'fxTooltip: hint', `fxTooltip` is the directive's
 * public name and `hint` the name on the host. A model is two-way on the host only if both halves are
 * exposed with matching names (`value: x` and `valueChange: xChange`); otherwise it is an input or an output.
 * A host directive's own host directives count too (`stack`, the classes read above `cls`, guards against
 * a cycle in broken code).
 */
function hostDirectiveBindings(
  cls: ClassDeclaration,
  meta: ObjectLiteralExpression | undefined,
  stack: Set<ClassDeclaration>,
): { bindings: Bindings; directives: HostDirective[] } {
  const bindings: Bindings = { inputs: [], outputs: [], models: [] };
  const directives: HostDirective[] = [];
  const list = propOf(meta, 'hostDirectives');
  if (!list) return { bindings, directives };
  if (!Node.isArrayLiteralExpression(list)) {
    warnings.push(`${cls.getName()}: \`hostDirectives\` is not an array literal, not documented`);
    return { bindings, directives };
  }
  // 'name' or 'name: alias' → [name, alias]
  const mappings = (n?: Node) =>
    n && Node.isArrayLiteralExpression(n)
      ? n.getElements().flatMap((e) => {
          const [name = '', alias] = (str(e) ?? '').split(':').map((s) => s.trim());
          return name ? [[name, alias || name] as const] : [];
        })
      : [];
  const chain = new Set([...stack, cls]);

  for (const el of list.getElements()) {
    const ref = Node.isObjectLiteralExpression(el) ? propOf(el, 'directive') : el;
    const decl = ref ? classOf(ref) : undefined;
    const name = decl?.getName() ?? ref?.getText() ?? oneLine(el.getText());
    if (!decl) {
      warnings.push(`${cls.getName()}: host directive \`${name}\` not resolved, not documented`);
      continue;
    }
    const pkg = decl.getSourceFile().isInNodeModules() ? packageOf(decl.getSourceFile().getFilePath()) : undefined;
    const own = pkg ? externalBindings(decl) : chain.has(decl) ? undefined : fullBindings(decl, chain);
    if (!own) {
      warnings.push(`${cls.getName()}: bindings of host directive ${name}${pkg ? ` (${pkg})` : ''} could not be read`);
      directives.push({ name, decl, pkg, exposed: [] });
      continue;
    }
    const inputs = mappings(Node.isObjectLiteralExpression(el) ? propOf(el, 'inputs') : undefined);
    const outputs = mappings(Node.isObjectLiteralExpression(el) ? propOf(el, 'outputs') : undefined);
    const exposed: HostDirective['exposed'] = [];
    // Exposed on the host: renamed, marked with its directive. Its origin on the directive side no longer matters.
    const expose = (m: Member, alias: string, list: Member[], binding: BindingKind) => {
      list.push({ ...m, name: alias, prop: `${name}.${m.prop}`, inheritedFrom: undefined, fromHostDirective: decl });
      exposed.push({ binding, name: alias });
    };
    const twoWay = new Set<string>(); // `xChange` outputs already exposed as the second half of a model
    for (const [publicName, alias] of inputs) {
      const input = own.inputs.find((m) => m.name === publicName);
      const model = own.models.find((m) => m.name === publicName);
      const change = outputs.find(([n]) => n === `${publicName}Change`);
      if (input) expose(input, alias, bindings.inputs, 'input');
      else if (model && change?.[1] === `${alias}Change`) {
        expose(model, alias, bindings.models, 'model');
        twoWay.add(change[0]);
      } else if (model) expose(model, alias, bindings.inputs, 'input'); // without its matching output: a plain input
      else warnings.push(`${cls.getName()}: host directive ${name} has no input \`${publicName}\` to expose`);
    }
    for (const [publicName, alias] of outputs) {
      if (twoWay.has(publicName)) continue;
      const output = own.outputs.find((m) => m.name === publicName);
      const model = own.models.find((m) => `${m.name}Change` === publicName);
      if (output) expose(output, alias, bindings.outputs, 'output');
      // The `xChange` half of a model alone: an output, so no default, required flag or transform.
      else if (model) expose({ ...model, default: undefined, required: false, transform: undefined }, alias, bindings.outputs, 'output');
      else warnings.push(`${cls.getName()}: host directive ${name} has no output \`${publicName}\` to expose`);
    }
    directives.push({ name, decl, pkg, exposed });
  }
  return { bindings, directives };
}

/**
 * Everything a class offers to templates: own and inherited bindings, then those exposed by its host
 * directives, and the list of those directives.
 */
export function fullBindings(cls: ClassDeclaration, stack = new Set<ClassDeclaration>()): Bindings & { directives: HostDirective[] } {
  const meta = metadata(ngDecorator(cls));
  const own = allBindings(cls, meta);
  const host = hostDirectiveBindings(cls, meta, stack);
  return {
    inputs: [...own.inputs, ...host.bindings.inputs],
    outputs: [...own.outputs, ...host.bindings.outputs],
    models: [...own.models, ...host.bindings.models],
    directives: host.directives,
  };
}
