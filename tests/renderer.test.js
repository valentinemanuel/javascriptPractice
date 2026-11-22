import test from 'node:test';
import assert from 'node:assert/strict';
import { registry } from '../js/registry.js';
import { render } from '../js/core/renderers/svg.js';
import { HashTable } from '../js/structures/hash-table.js';
import { compute as computeHashLayout } from '../js/core/layout/hash.js';

function drain(iterator) {
  for (const _step of iterator) { /* apply without animating */ }
}

class FakeNode {
  constructor(name) {
    this.name = name;
    this.attributes = {};
    this.children = [];
    this.textContent = '';
  }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] ?? null; }
  append(...nodes) { this.children.push(...nodes); }
  prepend(...nodes) { this.children.unshift(...nodes); }
  replaceChildren() { this.children = []; }
  querySelector(selector) {
    const matches = (node) => selector.startsWith('#')
      ? node.attributes.id === selector.slice(1)
      : node.name === selector;
    for (const child of this.children) {
      if (matches(child)) return child;
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }
}

globalThis.document = { createElementNS: (_namespace, name) => new FakeNode(name) };

function draw(id, step = {}) {
  const entry = registry[id];
  const structure = new entry.Structure();
  structure.reset(structure.meta.demo ?? []);
  const state = structure.getState();
  const svg = new FakeNode('svg');
  render(svg, state, entry.layout(state, { width: 900, height: 560 }), step);
  return svg;
}

function all(node, result = []) {
  result.push(node);
  for (const child of node.children) all(child, result);
  return result;
}

function withClass(nodes, className) {
  return nodes.filter((node) => (node.attributes.class ?? '').split(' ').includes(className));
}

function withClasses(nodes, ...classNames) {
  return nodes.filter((node) => classNames.every(
    (className) => (node.attributes.class ?? '').split(' ').includes(className),
  ));
}

function drawHashState(state, step) {
  const svg = new FakeNode('svg');
  render(svg, state, computeHashLayout(state, { width: 900, height: 560 }), step);
  return all(svg);
}

test('defs expose gradients, glow filter and both arrow markers', () => {
  const defs = draw('bst').querySelector('defs');
  assert.ok(defs, 'a defs block must be injected into the svg');
  for (const id of ['node-grad-default', 'node-grad-active', 'node-grad-found', 'glow', 'arrowhead', 'arrowhead-active']) {
    assert.ok(defs.querySelector(`#${id}`), `${id} must exist in defs`);
  }
  const filter = defs.querySelector('#glow');
  assert.ok(filter.children.some((child) => child.name === 'feGaussianBlur'));
  assert.ok(filter.children.some((child) => child.name === 'feMerge'));
  assert.equal(defs.querySelector('#arrowhead').attributes.markerUnits, 'userSpaceOnUse');
});

test('tree edges use cubic Bézier paths while graph edges stay straight', () => {
  const treeNodes = all(draw('bst'));
  const paths = treeNodes.filter((node) => node.name === 'path' && (node.attributes.class ?? '').includes('edge-tree'));
  assert.ok(paths.length > 0);
  assert.match(paths[0].attributes.d, /^M [\d.]+ [\d.]+ C [\d.]+ [\d.]+, [\d.]+ [\d.]+, [\d.]+ [\d.]+$/);
  assert.equal(treeNodes.filter((node) => node.name === 'line' && (node.attributes.class ?? '').includes('edge')).length, 0);

  const graphNodes = all(draw('graph'));
  assert.ok(graphNodes.some((node) => node.name === 'line' && (node.attributes.class ?? '').includes('edge')));
});

test('trie and graph edge labels use a rounded badge with text', () => {
  for (const id of ['trie', 'graph']) {
    const badges = withClass(all(draw(id)), 'edge-label');
    assert.ok(badges.length > 0, `${id} must render edge badges`);
    for (const badge of badges) {
      const rect = badge.children.find((child) => child.name === 'rect');
      const text = badge.children.find((child) => child.name === 'text');
      assert.equal(rect.attributes.rx, '6');
      assert.ok(text.textContent.length > 0);
    }
  }
});

test('terminal trie nodes get concentric thin rings and pointers are marked', () => {
  const trieNodes = all(draw('trie'));
  assert.ok(withClass(trieNodes, 'is-terminal').length > 0);
  assert.ok(withClass(trieNodes, 'terminal-ring').length >= 2);

  const queueNodes = all(draw('queue'));
  assert.equal(withClass(queueNodes, 'is-pointer').length, 2);
});

test('hash diagram draws keys, a hash box and an Index/Value table', () => {
  const nodes = all(draw('hash-table'));
  assert.ok(withClass(nodes, 'hash-key').length > 0);
  assert.equal(withClass(nodes, 'hash-function-box').length, 1);
  assert.equal(withClass(nodes, 'hash-table-header').length, 1);
  const rows = withClass(nodes, 'hash-row');
  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) => row.children.some(
    (child) => (child.attributes.class ?? '').includes('hash-row-index'),
  )));
});

test('hash rows distinguish occupied, empty and tombstone slots', () => {
  const table = new HashTable().reset();
  drain(table.useLinearProbing());
  for (const value of [1, 8]) drain(table.put(value));

  let nodes = drawHashState(table.getState(), { type: 'hash', payload: {} });
  assert.ok(withClasses(nodes, 'hash-row', 'is-occupied').length > 0);
  assert.ok(withClasses(nodes, 'hash-row', 'is-empty').length > 0);
  assert.equal(withClass(nodes, 'hash-key-arrow').length, 3); // two keys + the active input card

  drain(table.remove(1));
  nodes = drawHashState(table.getState(), { type: 'hash', payload: {} });
  assert.ok(withClasses(nodes, 'hash-row', 'is-tombstone').length > 0);
});

test('probe steps draw numbered arrows from the hash function', () => {
  const table = new HashTable().reset();
  drain(table.useLinearProbing());
  for (const value of [1, 8]) drain(table.put(value));
  const steps = [...table.put(15)];
  const probeStep = steps.filter((step) => step.type === 'probe').at(-1);
  assert.ok(probeStep);

  const nodes = drawHashState(table.getState(), probeStep);
  assert.ok(withClass(nodes, 'hash-probe-arrow').length > 0);
  const badges = withClass(nodes, 'hash-probe-badge');
  assert.equal(badges.length, probeStep.payload.probe.length);
  assert.equal(badges[0].textContent, '1');

  const hashResult = nodes.find((node) => node.attributes.class === 'hash-function-result');
  assert.equal(hashResult.textContent, probeStep.payload.expression);
  assert.match(hashResult.textContent, /mod 7 = 1/);

  const curves = nodes.filter((node) => (node.attributes.class ?? '').includes('hash-probe-arrow'));
  assert.ok(curves.length > 0);
  assert.ok(curves.every((curve) => curve.name === 'path' && / C /.test(curve.attributes.d)));
  assert.ok(curves.every((curve) => /is-animating/.test(curve.attributes.class)));

  const positions = computeHashLayout(table.getState(), { width: 900, height: 560 });
  const target = positions.get(probeStep.payload.probe.at(-1));
  const tableLeft = target.x - target.width / 2;
  assert.ok(curves.some((curve) => curve.attributes.d.endsWith(` ${tableLeft} ${target.y}`)));

  const input = withClass(nodes, 'hash-input-card')[0];
  assert.match(input.children[1].textContent, /^Key: 15$/);
});

test('chaining draws linked key nodes to the right of the value cell', () => {
  const table = new HashTable().reset();
  drain(table.useChaining());
  drain(table.put(1));
  drain(table.put(8));

  const nodes = drawHashState(table.getState(), { type: 'hash', payload: { key: 8 } });
  const chainNodes = withClass(nodes, 'hash-chain-node');
  assert.ok(chainNodes.length > 0);
  assert.ok(chainNodes.some((node) => node.children[1].textContent === '[8]'));
  assert.ok(withClass(nodes, 'hash-chain-arrow').length > 0);
});

test('the scene transform survives repeated renders', () => {
  const svg = draw('bst');
  const scene = svg.querySelector('#scene');
  scene.setAttribute('transform', 'translate(12 8) scale(1.3)');
  const structure = new registry.bst.Structure();
  structure.reset(structure.meta.demo);
  render(svg, structure.getState(), new Map(), {});
  assert.equal(svg.querySelector('#scene').getAttribute('transform'), 'translate(12 8) scale(1.3)');
});

test('the hash path also preserves the scene transform', () => {
  const table = new HashTable().reset();
  for (const value of [1, 8]) drain(table.put(value));
  const svg = new FakeNode('svg');
  const positions = computeHashLayout(table.getState(), { width: 900, height: 560 });
  render(svg, table.getState(), positions, { type: 'hash', payload: {} });
  svg.querySelector('#scene').setAttribute('transform', 'translate(3 4) scale(0.8)');
  render(svg, table.getState(), positions, { type: 'hash', payload: {} });
  assert.equal(svg.querySelector('#scene').getAttribute('transform'), 'translate(3 4) scale(0.8)');
});
