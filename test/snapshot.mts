/**
 * Snapshot test of ng-agent-docs.mts: runs it on the fixtures and compares the result with
 * the expected output committed in test/fixtures/expected/.
 *
 *   node test/snapshot.mts                    → compare (exit code 1 on any difference)
 *   node test/snapshot.mts --update           → accept the current output as the new expected output
 *   node test/snapshot.mts --bin <file>       → test another build of the generator, e.g. the published
 *                                               dist/ng-agent-docs.mjs: same expected output
 *
 * Each case records, in expected/<case>/:
 *   console.txt   the command, what the generator printed, and its exit code
 *   agent-docs/   the generated files (all of them, or only the listed ones)
 *
 * After changing the generator: run the test, read the diff, then --update if the change is intended.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';

const { values: options } = parseArgs({
  options: { update: { type: 'boolean', default: false }, bin: { type: 'string' } },
});
const REPO = dirname(import.meta.dirname);
const GENERATOR = options.bin ? resolve(options.bin) : join(REPO, 'ng-agent-docs.mts');
const FIXTURES = join(import.meta.dirname, 'fixtures');
const EXPECTED = join(FIXTURES, 'expected');
const UPDATE = options.update;

// =============================================================================
// Test cases — paths are relative to test/fixtures/
// =============================================================================
interface Case {
  name: string;
  args: string[]; // `{scratch}` is replaced with a temp folder of the case, prepared by `prepare`
  docs?: true | string[]; // record every generated file, or only these ones (relative to agent-docs/)
  ownOut?: boolean; // the args give --out themselves: the runner does not add its own
  prepare?: (scratch: string) => void;
  check?: (scratch: string) => string[]; // extra lines recorded in console.txt, after the run
}

// Copy of a fixture in the scratch folder: --out safety cases point the generator at it, so a broken
// safety check can only delete temp files, never the fixtures. The decoy folders are not copied.
const copyFixture = (fixture: string, to: string) =>
  cpSync(join(FIXTURES, fixture), to, {
    recursive: true,
    filter: (src) => !DECOY_DIRS.some((d) => isInside(src, join(FIXTURES, fixture, d.split('/')[0] ?? d))),
  });
const stillThere = (scratch: string, file: string) =>
  `${file}: ${existsSync(join(scratch, file)) ? 'still there' : 'DELETED'}`;

// Default --out: a copy of single-entry in <scratch>/lib, built (or not) into the `dest` of its ng-package.json.
// The repo's node_modules are linked next to it, so its types resolve as in the fixture.
function libWithDest(scratch: string, dest?: string): void {
  copyFixture('single-entry', join(scratch, 'lib'));
  symlinkSync(nodeModules(), join(scratch, 'node_modules'), 'dir');
  const ngPackage = join(scratch, 'lib', 'ng-package.json');
  const config = JSON.parse(readFileSync(ngPackage, 'utf8')) as Record<string, unknown>;
  writeFileSync(ngPackage, JSON.stringify(dest ? { ...config, dest } : config, null, 2) + '\n');
}
const built = (dir: string, name: string) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0' }) + '\n');
};
// What the built package holds after the run: the pages are counted, not listed (single-entry records them).
const generatedIn = (scratch: string, dir: string) => {
  const files = walk(join(scratch, dir));
  const pages = files.filter((f) => f.startsWith('agent-docs/api/'));
  return [
    `${dir}/: ${files.length} file(s)`,
    ...files.filter((f) => !pages.includes(f)).map((f) => `  ${f}`),
    `  agent-docs/api/: ${pages.length} page(s)`,
  ];
};

const CASES: Case[] = [
  // Secondary entry points, broken entry point, decoy folders: warnings, but exit code 0.
  { name: 'multi-entry', args: ['--root', 'multi-entry'], docs: true },
  { name: 'multi-entry-strict', args: ['--root', 'multi-entry', '--strict'] },
  // Single entry point, two --note lines.
  {
    name: 'single-entry',
    args: ['--root', 'single-entry', '--note', 'Legacy library: in new code, prefer @acme/ui (marked ⚠️).', '--note', 'Second note.'],
    docs: true,
  },
  { name: 'single-entry-strict', args: ['--root', 'single-entry', '--strict'] },
  // tsconfig.alt.json turns `strict` off: optional types lose their `| undefined`, proving the option is used.
  {
    name: 'custom-tsconfig',
    args: ['--root', 'single-entry', '--tsconfig', 'single-entry/tsconfig.alt.json'],
    docs: ['api/FxButton.md'],
  },
  // Usage errors: exit code 2, never 1 (incomplete docs in --strict mode), and no stack trace.
  { name: 'missing-root', args: [] },
  { name: 'unknown-option', args: ['--root', 'single-entry', '--stict'] },
  { name: 'missing-tsconfig', args: ['--root', 'single-entry', '--tsconfig', 'single-entry/missing.json'] },
  { name: 'no-entry-point', args: ['--root', 'no-entry-point'] },
  // --out safety: refused with exit code 2, nothing deleted.
  {
    name: 'out-is-library',
    args: ['--root', '{scratch}/lib', '--out', '{scratch}/lib'],
    ownOut: true,
    prepare: (scratch) => copyFixture('no-entry-point', join(scratch, 'lib')),
    check: (scratch) => [stillThere(scratch, 'lib/package.json')],
  },
  {
    name: 'out-contains-library',
    args: ['--root', '{scratch}/lib', '--out', '{scratch}'],
    ownOut: true,
    prepare: (scratch) => copyFixture('no-entry-point', join(scratch, 'lib')),
    check: (scratch) => [stillThere(scratch, 'lib/package.json')],
  },
  {
    name: 'out-not-generated',
    args: ['--root', 'single-entry', '--out', '{scratch}/notes'],
    ownOut: true,
    prepare: (scratch) => {
      mkdirSync(join(scratch, 'notes'), { recursive: true });
      writeFileSync(join(scratch, 'notes', 'todo.md'), 'Not generated: must survive.\n');
    },
    check: (scratch) => [stillThere(scratch, 'notes/todo.md')],
  },
  // Generated before, then files were added: refused too. The index marker alone does not make it safe.
  {
    name: 'out-generated-then-edited',
    args: ['--root', 'single-entry', '--out', '{scratch}/docs'],
    ownOut: true,
    prepare: (scratch) => {
      mkdirSync(join(scratch, 'docs', 'api'), { recursive: true });
      mkdirSync(join(scratch, 'docs', 'src'), { recursive: true });
      writeFileSync(join(scratch, 'docs', 'index.md'), '> Generated by ng-agent-docs. Do not edit.\n');
      writeFileSync(join(scratch, 'docs', 'api', 'FxOld.md'), 'Generated page.\n');
      writeFileSync(join(scratch, 'docs', 'api', 'notes.txt'), 'Not generated: must survive.\n');
      writeFileSync(join(scratch, 'docs', 'GUIDE.md'), 'Not generated: must survive.\n');
      writeFileSync(join(scratch, 'docs', 'src', 'app.ts'), '// Not generated: must survive.\n');
      writeFileSync(join(scratch, 'docs', '.DS_Store'), ''); // added by the OS: not reported
    },
    check: (scratch) => ['docs/GUIDE.md', 'docs/src/app.ts', 'docs/api/notes.txt'].map((f) => stillThere(scratch, f)),
  },
  // A secondary entry point named like the --out folder (`button`) is still documented: 8 entry points.
  {
    name: 'out-named-like-entry-point',
    args: ['--root', 'multi-entry', '--out', '{scratch}/button'],
    ownOut: true,
  },
  // No symbol gets a page: the output folder (wiped) is recreated for index.md, which lists nothing.
  {
    name: 'empty-library',
    args: ['--root', '{scratch}/lib'],
    docs: true,
    prepare: (scratch) => {
      mkdirSync(join(scratch, 'lib'), { recursive: true });
      const files = {
        'package.json': JSON.stringify({ name: '@fixtures/empty', version: '1.0.0' }),
        'ng-package.json': JSON.stringify({ lib: { entryFile: 'index.ts' } }),
        'tsconfig.lib.json': JSON.stringify({ compilerOptions: { strict: true, noEmit: true }, files: ['index.ts'] }),
        'index.ts': 'export {};',
      };
      for (const [file, content] of Object.entries(files)) writeFileSync(join(scratch, 'lib', file), content + '\n');
    },
  },
  // Default --out: <dest>/agent-docs, next to the built package.json; the package itself is left alone.
  {
    name: 'out-default',
    args: ['--root', '{scratch}/lib'],
    ownOut: true,
    prepare: (scratch) => {
      libWithDest(scratch, '../dist/lib');
      built(join(scratch, 'dist', 'lib'), '@fixtures/single-entry');
    },
    check: (scratch) => generatedIn(scratch, 'dist/lib'),
  },
  // Not built yet (here with ng-packagr's default dest, <root>/dist): refused with exit code 2.
  {
    name: 'out-default-not-built',
    args: ['--root', '{scratch}/lib'],
    ownOut: true,
    prepare: (scratch) => libWithDest(scratch),
  },
  // `dest` holds another package: refused with exit code 2, nothing written there.
  {
    name: 'out-default-other-package',
    args: ['--root', '{scratch}/lib'],
    ownOut: true,
    prepare: (scratch) => {
      libWithDest(scratch, '../dist/lib');
      built(join(scratch, 'dist', 'lib'), '@fixtures/other');
    },
    check: (scratch) => generatedIn(scratch, 'dist/lib'),
  },
];

// Folders the generator must never scan. Created for the run only (git usually ignores
// node_modules/ and dist/, so they could not be committed).
const DECOY_DIRS = ['dist', 'node_modules/decoy', '.cache'];
const DECOY_ROOTS = ['multi-entry', 'single-entry'];

// =============================================================================
// Helpers
// =============================================================================
const toPosix = (p: string) => p.split(sep).join('/');
const isInside = (file: string, dir: string) => file === dir || file.startsWith(dir + sep);

/** The node_modules folder that Node resolves the fixtures' packages from (the nearest one above test/). */
function nodeModules(): string {
  for (let dir = import.meta.dirname; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'node_modules', '@angular', 'core'))) return join(dir, 'node_modules');
    if (dirname(dir) === dir) throw new Error('@angular/core not found in any node_modules above test/: run npm install');
  }
}

/** Every file under `dir`, relative to it, sorted. */
function walk(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name), base) : [relative(base, join(dir, d.name))]))
    .map(toPosix)
    .sort();
}

function createDecoys(): string[] {
  const created: string[] = [];
  for (const root of DECOY_ROOTS) {
    for (const d of DECOY_DIRS) {
      const dir = join(FIXTURES, root, d);
      if (existsSync(dir)) throw new Error(`${toPosix(relative(FIXTURES, dir))} already exists: remove it first`);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'ng-package.json'), '{ "lib": { "entryFile": "index.ts" } }\n');
      writeFileSync(join(dir, 'index.ts'), '/** Decoy: must never be documented. */\nexport const DECOY = true;\n');
      created.push(join(FIXTURES, root, d.split('/')[0] ?? d));
    }
  }
  return created;
}

/** Runs one case in `<runs>/<case>/`, then records what it checks in `<actual>/<case>/`. */
function run(c: Case, runs: string, actual: string): void {
  const caseDir = join(actual, c.name);
  const out = join(runs, c.name, 'agent-docs');
  const scratch = join(runs, c.name, 'scratch');
  mkdirSync(scratch, { recursive: true });
  c.prepare?.(scratch);
  // Output of a previous run (its index.md has the generated marker), with a stale page: the generator
  // may wipe this folder, and must delete the stale page.
  mkdirSync(join(out, 'api'), { recursive: true });
  writeFileSync(join(out, 'index.md'), '> Generated by ng-agent-docs. Do not edit.\n');
  writeFileSync(join(out, 'api', 'STALE.md'), 'must be deleted\n');

  const caseArgs = c.args.map((a) => a.replaceAll('{scratch}', scratch));
  const args = c.args.length && !c.ownOut ? [...caseArgs, '--out', out] : caseArgs;
  const result = spawnSync(process.execPath, [GENERATOR, ...args], {
    cwd: FIXTURES,
    encoding: 'utf8',
    env: { ...process.env, NODE_NO_WARNINGS: '1' }, // Node's own warnings vary between versions
  });

  // Machine-specific paths are replaced, so the snapshot is the same everywhere.
  const normalize = (s = '') =>
    s
      .replaceAll(out, '<out>')
      .replaceAll(scratch, '<scratch>')
      .replaceAll(FIXTURES, '<fixtures>')
      .replaceAll('\\', '/')
      .trimEnd();
  const shownArgs = args.map((a) => normalize(a.includes(' ') ? JSON.stringify(a) : a));
  const console = [
    `$ ng-agent-docs ${shownArgs.join(' ')}`.trimEnd(), // the same whichever build of the generator runs
    '',
    '--- stdout',
    normalize(result.stdout),
    '--- stderr',
    normalize(result.stderr),
    '---',
    `exit code: ${result.status}`,
    ...(c.check?.(scratch) ?? []),
    '',
  ].join('\n');

  const docs = c.docs === true ? walk(out) : (c.docs ?? []);
  rmSync(caseDir, { recursive: true, force: true });
  mkdirSync(caseDir, { recursive: true });
  writeFileSync(join(caseDir, 'console.txt'), console);
  for (const file of docs) {
    const from = join(out, file);
    const to = join(caseDir, 'agent-docs', file);
    mkdirSync(dirname(to), { recursive: true });
    if (existsSync(from)) cpSync(from, to);
    else writeFileSync(to, '(file not generated)\n');
  }
}

/** Differences between two folders, as `path: reason` lines. */
function compare(expected: string, actual: string): string[] {
  const files = [...new Set([...walk(expected), ...walk(actual)])].sort();
  return files.flatMap((f) => {
    const e = join(expected, f);
    const a = join(actual, f);
    if (!existsSync(e)) return [`+ ${f} (new file)`];
    if (!existsSync(a)) return [`- ${f} (no longer generated)`];
    return readFileSync(e, 'utf8') === readFileSync(a, 'utf8') ? [] : [`~ ${f}`];
  });
}

// =============================================================================
// Main
// =============================================================================
const runs = mkdtempSync(join(tmpdir(), 'agent-docs-runs-')); // raw generator output
const actual = mkdtempSync(join(tmpdir(), 'agent-docs-actual-')); // what is compared with expected/
const decoys = createDecoys();
try {
  for (const c of CASES) run(c, runs, actual);
} finally {
  for (const d of decoys) rmSync(d, { recursive: true, force: true });
  rmSync(runs, { recursive: true, force: true });
}

if (UPDATE) {
  rmSync(EXPECTED, { recursive: true, force: true });
  cpSync(actual, EXPECTED, { recursive: true });
  rmSync(actual, { recursive: true, force: true });
  console.log(`Expected output updated: ${CASES.length} cases → ${toPosix(relative(process.cwd(), EXPECTED))}`);
  process.exit(0);
}

const differences = compare(EXPECTED, actual);
if (!differences.length) {
  rmSync(actual, { recursive: true, force: true });
  console.log(`agent-docs snapshot test: ${CASES.length} cases OK`);
  process.exit(0);
}

console.error(`agent-docs snapshot test: ${differences.length} difference(s)\n`);
console.error(differences.map((d) => `  ${d}`).join('\n'));
// Line-by-line diff, when git is available (it works outside a repository with --no-index).
spawnSync('git', ['--no-pager', 'diff', '--no-index', '--color=always', EXPECTED, actual], { stdio: 'inherit' });
console.error(`\nActual output kept in ${actual}`);
console.error('If the change is intended: node test/snapshot.mts --update');
process.exit(1);
