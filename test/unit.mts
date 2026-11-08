/**
 * Unit tests of the text parsers: the regex-heavy helpers, whose edge cases are cheaper to pin here than
 * with a fixture. The generator as a whole is covered by the snapshot test (test/snapshot.mts).
 *
 *   node --test test/unit.mts
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { slotsOf } from '../lib/describe.mts';
import { entryDescription } from '../lib/entry-points.mts';
import { parseJsDoc, parseParam } from '../lib/jsdoc.mts';
import { code, firstParagraph, summary } from '../lib/util.mts';

describe('parseJsDoc', () => {
  test('splits the description from the tags', () => {
    assert.deepEqual(parseJsDoc('Button.\n@usage Forms\n@avoid Links'), {
      description: 'Button.',
      tags: [
        { name: 'usage', text: 'Forms' },
        { name: 'avoid', text: 'Links' },
      ],
    });
  });

  test('a tag spans the next lines, up to the next tag', () => {
    assert.deepEqual(parseJsDoc('@replacedBy fx-button,\nwith a label').tags, [{ name: 'replacedBy', text: 'fx-button,\nwith a label' }]);
  });

  test('our tags can follow text on one line, not in inline code', () => {
    assert.deepEqual(parseJsDoc('Old. @deprecated Use `@usage` tags.').tags, [{ name: 'deprecated', text: 'Use `@usage` tags.' }]);
    assert.equal(parseJsDoc('Uses `x @deprecated y`.').description, 'Uses `x @deprecated y`.');
  });

  test('a decorator in the description is not a tag', () => {
    assert.deepEqual(parseJsDoc('Reads its @Input() values.'), { description: 'Reads its @Input() values.', tags: [] });
  });

  test('Angular control flow stays in an @example', () => {
    const { tags } = parseJsDoc('@example\n@if (open) {\n  <p>Hi</p>\n} @else {\n}\n@for (x of xs; track x) {}');
    assert.equal(tags.length, 1);
    assert.match(tags[0]!.text, /@else \{\n\}\n@for/);
  });

  test('@case … @default on one line of an @example is not split', () => {
    const { tags } = parseJsDoc('@example\n@switch (x) { @case (1) {<a/>} @default {<b/>} }');
    assert.deepEqual(tags, [{ name: 'example', text: '@switch (x) { @case (1) {<a/>} @default {<b/>} }' }]);
  });

  test('nothing is a tag inside a code fence', () => {
    const { tags } = parseJsDoc('@example\n```ts\n@Component({})\nclass A {}\n```');
    assert.deepEqual(tags, [{ name: 'example', text: '```ts\n@Component({})\nclass A {}\n```' }]);
  });
});

describe('parseParam', () => {
  test('JSDoc forms', () => {
    assert.deepEqual(parseParam('value the value'), { name: 'value', text: 'the value' });
    assert.deepEqual(parseParam('value - the value'), { name: 'value', text: 'the value' });
    assert.deepEqual(parseParam('{string} value the value'), { name: 'value', text: 'the value' });
    assert.deepEqual(parseParam('[digits=2] decimals'), { name: 'digits', text: 'decimals' });
    assert.deepEqual(parseParam('options.size size of the dialog'), { name: 'options.size', text: 'size of the dialog' });
    assert.deepEqual(parseParam('x'), { name: 'x', text: '' });
  });

  test('a negative number in the text is not a dash separator', () => {
    assert.deepEqual(parseParam('offset -1 means the end'), { name: 'offset', text: '-1 means the end' });
  });

  test('no name: ignored', () => {
    assert.equal(parseParam(''), undefined);
  });
});

describe('summary', () => {
  test('first sentence', () => {
    assert.equal(summary('Action button. Has variants.'), 'Action button.');
  });
  test('an abbreviation followed by a lowercase word does not end it', () => {
    assert.equal(summary('Shows a hint, e.g. a tooltip. More.'), 'Shows a hint, e.g. a tooltip.');
  });
  test('the first paragraph only, on one line', () => {
    assert.equal(summary('Wrapped\nover two lines\n\nSecond paragraph.'), 'Wrapped over two lines');
  });
});

describe('firstParagraph', () => {
  test('ends at a list, a heading or a fence', () => {
    assert.equal(firstParagraph('Intro\n- item'), 'Intro');
    assert.equal(firstParagraph('Intro\n## Title'), 'Intro');
    assert.equal(firstParagraph('Intro\n```ts\ncode\n```'), 'Intro');
  });
});

describe('code', () => {
  test('inline code that survives backticks', () => {
    assert.equal(code('a'), '`a`');
    assert.equal(code('`${x}`'), '`` `${x}` ``');
    assert.equal(code('multi\n  line'), '`multi line`');
  });
});

describe('slotsOf', () => {
  test('default first, then the named slots in template order', () => {
    assert.deepEqual(slotsOf('<ng-content select="[a]" /><ng-content></ng-content><ng-content select=".b"/>'), [
      'default',
      '[a]',
      '.b',
    ]);
  });
  test('a select holding the other kind of quotes', () => {
    assert.deepEqual(slotsOf(`<ng-content select="input[type='checkbox']" />`), [`input[type='checkbox']`]);
    assert.deepEqual(slotsOf(`<ng-content select='[x="y"]' />`), ['[x="y"]']);
  });
  test('a `>` inside an attribute value does not end the element', () => {
    assert.deepEqual(slotsOf('<ng-content ngProjectAs="a>b" select="[c]" />'), ['[c]']);
  });
  test('comments and look-alike elements are ignored', () => {
    assert.deepEqual(slotsOf('<!-- <ng-content select="[old]" /> --><ng-content-x select="[y]"></ng-content-x>'), []);
  });
  test('only the select attribute, not one ending with it', () => {
    assert.deepEqual(slotsOf('<ng-content data-select="[x]" />'), ['default']);
  });
});

describe('entryDescription', () => {
  test('the @packageDocumentation block, without the tag', () => {
    assert.equal(entryDescription('/** Form fields. @packageDocumentation */\nexport * from "./a";'), 'Form fields.');
  });
  test('after a license header and line comments', () => {
    const source = '/**\n * @license MIT\n */\n// Generated.\n/**\n * Pipes.\n * @packageDocumentation\n */\nexport {};';
    assert.equal(entryDescription(source), 'Pipes.');
  });
  test('CRLF line endings', () => {
    assert.equal(entryDescription('/**\r\n * Pipes.\r\n * @packageDocumentation\r\n */\r\n'), 'Pipes.');
  });
  test('not looked for after the first statement', () => {
    assert.equal(entryDescription('export * from "./a";\n/** Late. @packageDocumentation */'), undefined);
  });
  test('none', () => {
    assert.equal(entryDescription('/** Just a comment. */\nexport {};'), undefined);
  });
});
