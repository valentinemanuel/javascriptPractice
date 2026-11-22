import test from 'node:test';
import assert from 'node:assert/strict';
import { registry } from '../js/registry.js';
import { render } from '../js/core/renderers/svg.js';

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

test('hash slots use rx=6 and a separated index badge', () => {
  const nodes = all(draw('hash-table'));
  const slots = withClass(nodes, 'hash-slot');
  assert.ok(slots.length > 0);
  for (const slot of slots) {
    assert.equal(slot.children[0].attributes.rx, '6');
  }
  assert.equal(withClass(nodes, 'hash-index-badge').length, slots.length);
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
