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

test('stack uses rounded blocks, an open guide frame and centred index labels', () => {
  const svg = draw('stack');
  const nodes = all(svg);

  const guides = withClass(nodes, 'stack-guide');
  assert.equal(guides.length, 1);
  assert.match(guides[0].attributes.d, / Q /);
  assert.equal(guides[0].attributes.fill, 'none');

  const structure = new registry.stack.Structure();
  structure.reset(structure.meta.demo);
  const state = structure.getState();
  const positions = registry.stack.layout(state, { width: 900, height: 560 });
  const labels = withClass(nodes, 'index-label');
  assert.equal(labels.length, state.items.length);
  labels.forEach((label, index) => {
    const position = positions.get(state.items[index].id);
    assert.equal(label.attributes.y, String(position.y));
    assert.ok(Number(label.attributes.x) < position.x - 40);
  });

  const blocks = withClass(nodes, 'node')
    .flatMap((node) => node.children.filter((child) => child.name === 'rect'));
  assert.ok(blocks.length > 0);
  assert.ok(blocks.every((block) => block.attributes.rx === '8'));
});

test('array draws a contiguous cell strip with reserved free slots', () => {
  const structure = new registry.array.Structure().reset([5, 9]);
  const state = structure.getState();
  assert.ok(state.capacity > state.items.length);

  const positions = registry.array.layout(state, { width: 900, height: 560 });
  const svg = new FakeNode('svg');
  render(svg, state, positions, {});
  const nodes = all(svg);

  const cells = withClass(nodes, 'array-cell');
  assert.equal(cells.length, state.items.length);
  const free = withClass(nodes, 'array-free-cell');
  assert.equal(free.length, state.capacity - state.items.length);
  assert.equal(withClass(nodes, 'array-free-index').length, free.length);

  const sorted = [...cells].sort((a, b) => Number(a.attributes.x) - Number(b.attributes.x));
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    assert.equal(
      Number(previous.attributes.x) + Number(previous.attributes.width),
      Number(current.attributes.x),
    );
  }

  const labels = withClass(nodes, 'index-label');
  assert.equal(labels.length, state.items.length);
  labels.forEach((label, index) => {
    const position = positions.get(state.items[index].id);
    assert.equal(label.attributes.y, String(position.y + 52));
  });

  const stripMidpoint = (layout) => {
    const boxes = [...layout.values()].filter((position) => position.free !== undefined
      || position.index !== undefined);
    const left = Math.min(...boxes.map((position) => position.x - position.width / 2));
    const right = Math.max(...boxes.map((position) => position.x + position.width / 2));
    return (left + right) / 2;
  };
  assert.equal(stripMidpoint(positions), 450);

  const grown = new registry.array.Structure().reset([5, 9, 2, 7]);
  drain(grown.insert(4, 42));
  const grownState = grown.getState();
  assert.equal(grownState.capacity, 8);
  const grownPositions = registry.array.layout(grownState, { width: 900, height: 560 });
  assert.equal(stripMidpoint(grownPositions), 450);

  assert.equal(withClass(nodes, 'queue-guide').length, 0);
  assert.ok(withClass(nodes, 'node').every(
    (node) => !node.children.some((child) => child.name === 'circle'),
  ));
});

test('queue uses a horizontal lane, rounded blocks and FRONT/BACK arrows', () => {
  const nodes = all(draw('queue'));
  assert.equal(withClass(nodes, 'queue-guide').length, 2);

  const arrows = withClass(nodes, 'pointer-arrow');
  assert.equal(arrows.length, 2);
  const frontArrow = arrows.find((arrow) => arrow.attributes.class.includes('is-front'));
  const backArrow = arrows.find((arrow) => arrow.attributes.class.includes('is-back'));
  assert.ok(frontArrow && backArrow);
  assert.ok(Number(frontArrow.attributes.x2) < Number(frontArrow.attributes.x1));
  assert.ok(Number(backArrow.attributes.x2) > Number(backArrow.attributes.x1));
  assert.ok(arrows.every((arrow) => arrow.attributes['marker-end']));

  const frontLabel = withClass(nodes, 'pointer-label')
    .find((label) => label.attributes.class.includes('is-front'));
  const laneTop = Math.min(...withClass(nodes, 'queue-guide')
    .map((guide) => Number(guide.attributes.y1)));
  assert.ok(Number(frontLabel.attributes.y) < Number(frontArrow.attributes.y1));
  assert.ok(Number(frontArrow.attributes.y1) < laneTop);

  const blocks = withClass(nodes, 'node')
    .flatMap((node) => node.children.filter((child) => child.name === 'rect' && child.attributes.rx === '8'));
  assert.equal(blocks.length, 3);
});

test('linked list keeps circular nodes and HEAD/TAIL labels', () => {
  const nodes = all(draw('linked-list'));
  const labels = withClass(nodes, 'pointer-label');
  assert.ok(labels.some((label) => label.textContent === 'HEAD'));
  assert.ok(labels.some((label) => label.textContent === 'TAIL'));
  assert.ok(withClass(nodes, 'node').every(
    (node) => node.children.some((child) => child.name === 'circle'),
  ));
  assert.equal(withClass(nodes, 'queue-guide').length, 0);
  assert.equal(withClass(nodes, 'stack-guide').length, 0);
  assert.equal(withClass(nodes, 'pointer-arrow').length, 0);
});

test('multi-key tree edges start at their own separator', () => {
  const structure = new registry.btree.Structure().reset(registry.btree.Structure.meta.demo);
  const state = structure.getState();
  const positions = registry.btree.layout(state, { width: 900, height: 560 });
  const svg = new FakeNode('svg');
  render(svg, state, positions, {});
  const paths = withClass(all(svg), 'edge-tree');

  const grouped = new Map();
  state.edges.forEach((edge, order) => {
    if (!grouped.has(edge.from)) grouped.set(edge.from, []);
    grouped.get(edge.from).push({ edge, order });
  });
  const parent = [...grouped.values()].find((entries) => entries.length > 1);
  assert.ok(parent, 'the demo tree must have a parent with several children');

  const starts = parent.map(({ order }) => {
    const match = paths[order].attributes.d.match(/^M ([\d.-]+)/);
    assert.ok(match);
    return Number(match[1]);
  });
  assert.equal(new Set(starts).size, starts.length);
  assert.ok(starts.every((value, index) => index === 0 || value > starts[index - 1]));
  assert.ok(starts[0] < positions.get(parent[0].edge.from).x);
  assert.ok(starts.at(-1) > positions.get(parent[0].edge.from).x);
});

test('B+ tree connects its leaves with horizontal arrows', () => {
  const structure = new registry['b-plus-tree'].Structure();
  structure.reset(registry['b-plus-tree'].Structure.meta.demo);
  const state = structure.getState();
  const linked = state.nodes.filter((node) => node.next !== null && node.next !== undefined);
  assert.ok(linked.length > 0);

  const positions = registry['b-plus-tree'].layout(state, { width: 900, height: 560 });
  const svg = new FakeNode('svg');
  render(svg, state, positions, {});
  const links = withClass(all(svg), 'leaf-link');
  assert.equal(links.length, linked.length);
  for (const link of links) {
    assert.equal(link.attributes.y1, link.attributes.y2);
    assert.ok(link.attributes['marker-end']);
  }
});

test('trie root is marked with an empty-string symbol', () => {
  const structure = new registry.trie.Structure().reset(registry.trie.Structure.meta.demo);
  const state = structure.getState();
  const svg = new FakeNode('svg');
  render(svg, state, registry.trie.layout(state, { width: 900, height: 560 }), {});

  const root = withClass(all(svg), 'node').find((node) => node.attributes['data-id'] === state.root);
  assert.ok(root);
  assert.equal(root.children.find((child) => child.name === 'text').textContent, 'Ø');
});

test('directed edges stop at the outer edge of the destination circle', () => {
  const structure = new registry.graph.Structure().reset(registry.graph.Structure.meta.demo);
  drain(structure.useDirected());
  const state = structure.getState();
  const directed = state.edges.filter((edge) => edge.directed);
  assert.ok(directed.length > 0);

  const positions = registry.graph.layout(state, { width: 900, height: 560 });
  const svg = new FakeNode('svg');
  render(svg, state, positions, {});
  const edges = withClass(all(svg), 'edge');
  assert.equal(edges.length, state.edges.length);
  const line = edges[state.edges.indexOf(directed[0])];

  const target = positions.get(directed[0].to);
  const distance = Math.hypot(Number(line.attributes.x2) - target.x, Number(line.attributes.y2) - target.y);
  assert.ok(Math.abs(distance - 28) < 0.01, `expected 28px, got ${distance}`);
});

test('undirected edges stay centre to centre without an arrow marker', () => {
  const structure = new registry.graph.Structure().reset(registry.graph.Structure.meta.demo);
  const state = structure.getState();
  const positions = registry.graph.layout(state, { width: 900, height: 560 });
  const svg = new FakeNode('svg');
  render(svg, state, positions, {});

  const lines = withClass(all(svg), 'edge');
  assert.equal(lines.length, state.edges.length);
  for (const [index, edge] of state.edges.entries()) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    assert.equal(Number(lines[index].attributes.x1), from.x);
    assert.equal(Number(lines[index].attributes.y1), from.y);
    assert.equal(Number(lines[index].attributes.x2), to.x);
    assert.equal(Number(lines[index].attributes.y2), to.y);
    assert.equal(lines[index].attributes['marker-end'], undefined);
  }
});

test('visited vertices get the visited state class', () => {
  const structure = new registry.graph.Structure().reset(registry.graph.Structure.meta.demo);
  drain(structure.bfs(structure.getState().nodes[0].value));
  const state = structure.getState();
  const svg = new FakeNode('svg');
  render(svg, state, registry.graph.layout(state, { width: 900, height: 560 }), {});

  const visited = withClass(all(svg), 'is-visited');
  assert.equal(visited.length, state.nodes.filter((node) => node.visited).length);
  assert.ok(visited.length > 0);
});

test('distance labels show the current shortest distance', () => {
  const structure = new registry.graph.Structure().reset(registry.graph.Structure.meta.demo);
  const state = structure.getState();
  state.nodes[0].dist = 7;
  const svg = new FakeNode('svg');
  render(svg, state, registry.graph.layout(state, { width: 900, height: 560 }), {});

  const labels = withClass(all(svg), 'distance-label');
  assert.equal(labels.length, 1);
  assert.equal(labels[0].textContent, 'd = 7');
});

test('empty linear structures show a centred guide message', () => {
  const structure = new registry.stack.Structure().clear();
  const svg = new FakeNode('svg');
  render(svg, structure.getState(), new Map(), {}, { width: 900, height: 560 });

  const hints = withClass(all(svg), 'empty-hint');
  assert.equal(hints.length, 1);
  assert.equal(hints[0].attributes['data-empty-hint'], 'true');
  assert.match(hints[0].children[1].textContent, /Empty structure/);
});

test('arrays and hash tables draw their slots instead of an empty hint', () => {
  for (const id of ['array', 'hash-table']) {
    const structure = new registry[id].Structure().clear();
    const state = structure.getState();
    const svg = new FakeNode('svg');
    render(svg, state, registry[id].layout(state, { width: 900, height: 560 }), {});
    assert.equal(withClass(all(svg), 'empty-hint').length, 0, id);
  }
});

test('a finished shortest path is announced and its edges are highlighted', () => {
  const structure = new registry.graph.Structure().clear();
  for (const label of ['A', 'B', 'C']) drain(structure.addVertex(label));
  drain(structure.addEdge('A', 'B', 2));
  drain(structure.addEdge('B', 'C', 3));
  const state = structure.getState();
  const step = {
    type: 'done',
    payload: {
      path: ['A', 'B', 'C'],
      pathDistance: 5,
      pathEdges: state.edges.map(({ from, to }) => ({ from, to })),
    },
  };
  const svg = new FakeNode('svg');
  render(svg, state, registry.graph.layout(state, { width: 900, height: 560 }), step, { width: 900 });

  const banner = withClass(all(svg), 'result-banner');
  assert.equal(banner.length, 1);
  assert.match(banner[0].children[1].textContent, /Shortest path: A → B → C \(5\)/);
  assert.ok(withClass(all(svg), 'is-path').length > 0);
  assert.equal(state.edges.length, 2);
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
