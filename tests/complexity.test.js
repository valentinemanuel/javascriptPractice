import test from 'node:test';
import assert from 'node:assert/strict';
import { renderComplexity, complexityFor } from '../js/core/complexity.js';
import { meta } from '../js/structures/bst.js';

class FakeElement {
  constructor(name) {
    this.name = name;
    this.children = [];
    this.textContent = '';
    this.title = '';
    this.className = '';
    this.classList = {
      add: (className) => { this.className = `${this.className} ${className}`.trim(); },
    };
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren() { this.children = []; }
  setAttribute(key, value) { this[key] = value; }
}

globalThis.document = { createElement: (name) => new FakeElement(name) };

function all(node, result = []) {
  result.push(node);
  for (const child of node.children) all(child, result);
  return result;
}

test('complexity cells render notation pills only', () => {
  const container = new FakeElement('div');
  renderComplexity(container, meta, 'search', false);

  const nodes = all(container);
  assert.equal(nodes.filter((node) => node.name === 'small').length, 0);
  const pills = nodes.filter((node) => node.className === 'complexity-pill');
  assert.equal(pills.length, Object.keys(meta.operations).length * 3);
  for (const pill of pills) {
    assert.match(pill.textContent, /^(Ω|Θ|O)\(/);
    assert.match(pill.title, /case: .+/);
  }
});

test('the active operation row keeps its description below the table', () => {
  const container = new FakeElement('div');
  renderComplexity(container, meta, 'delete', false);

  const table = container.children[0];
  const note = container.children[1];
  assert.equal(table.name, 'table');
  assert.equal(note.name, 'p');
  assert.equal(note.className, 'complexity-note');
  assert.equal(note.textContent, meta.operations.delete.description);

  const body = table.children[1];
  const activeRow = body.children.find((row) => row.className.includes('is-active'));
  assert.ok(activeRow);
  assert.equal(activeRow.title, meta.operations.delete.description);
});

test('compact mode renders only the active operation plus a hint', () => {
  const container = new FakeElement('div');
  renderComplexity(container, meta, 'search', true);

  const pills = all(container).filter((node) => node.className === 'complexity-pill');
  assert.equal(pills.length, 3);
  const hints = container.children.filter((node) => node.textContent.includes('operations available'));
  assert.equal(hints.length, 1);
});

test('compact mode without an active operation falls back to the first row', () => {
  const container = new FakeElement('div');
  renderComplexity(container, meta, null, true);

  const firstSignature = Object.values(meta.operations)[0].signature;
  assert.ok(all(container).some((node) => node.textContent === firstSignature));
  assert.equal(all(container).filter((node) => node.className === 'complexity-pill').length, 3);
});

test('complexityFor handles missing entries and a null container is safe', () => {
  assert.equal(complexityFor(meta, 'search'), meta.operations.search);
  assert.equal(complexityFor(meta, 'missing'), null);
  assert.equal(complexityFor(null, 'search'), null);
  assert.doesNotThrow(() => renderComplexity(null, meta, 'search'));
});
