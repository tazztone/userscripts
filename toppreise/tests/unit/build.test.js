import test from 'node:test';
import assert from 'node:assert/strict';
import { stripModuleSyntax } from '../../tools/build.js';

test('stripModuleSyntax handles imports, wildcard re-exports, multiline exports and declarations', () => {
  const input = [
    'import { a,',
    '  b } from "./x.js";',
    'import "./style.css";',
    'export * from "./y.js";',
    'export * as foo from "./y.js";',
    'export { a,',
    '  b } from "./z.js";',
    'export {',
    '  foo,',
    '  bar as baz',
    '};',
    'export const x = 1;',
    'export let y = 2;',
    'export async function doThing() {}',
    'export default function main() {}',
    'export default class Engine {}'
  ].join('\n');

  const stripped = stripModuleSyntax(input);

  assert.ok(!stripped.includes('import'), 'all imports stripped');
  assert.ok(!stripped.includes('export'), 'all export keywords stripped');
  assert.ok(stripped.includes('const x = 1;'), 'const declaration preserved');
  assert.ok(stripped.includes('let y = 2;'), 'let declaration preserved');
  assert.ok(stripped.includes('async function doThing() {}'), 'async function preserved');
  assert.ok(stripped.includes('function main() {}'), 'default function preserved without export default');
  assert.ok(stripped.includes('class Engine {}'), 'default class preserved without export default');
});
