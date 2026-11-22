import test from 'node:test';
import assert from 'node:assert/strict';
import { AvlTree, meta } from '../js/structures/avl.js';

function drain(iterator) {
  let result = iterator.next();
  while (!result.done) result = iterator.next();
  return result.value;
}

function childMap(state) {
  const map = new Map();
  for (const edge of state.edges) {
    assert.ok(['left', 'right'].includes(edge.side), `unexpected edge side ${edge.side}`);
    const entry = map.get(edge.from) ?? {};
    assert.equal(entry[edge.side], undefined, 'a node has two children on the same side');
    entry[edge.side] = edge.to;
    map.set(edge.from, entry);
  }
  return map;
}

function inOrderValues(state, kids = childMap(state), id = state.root) {
  const values = [];
  const walk = (current) => {
    if (current === null) return;
    const node = state.nodes.find((item) => item.id === current);
    assert.ok(node, `missing node for id ${current}`);
    walk(kids.get(current)?.left ?? null);
    values.push(node.value);
    walk(kids.get(current)?.right ?? null);
  };
  walk(id);
  return values;
}

function assertConsistentFields(tree, label = '') {
  const state = tree.getState();
  const byId = new Map(state.nodes.map((node) => [node.id, node]));
  assert.equal(byId.size, state.nodes.length, `${label}: node ids must be unique`);
  for (const edge of state.edges) {
    assert.ok(byId.has(edge.from), `${label}: edge source must exist`);
    assert.ok(byId.has(edge.to), `${label}: edge target must exist`);
  }
  const kids = childMap(state);
  for (const node of state.nodes) {
    const children = kids.get(node.id) ?? {};
    const left = children.left ? byId.get(children.left) : null;
    const right = children.right ? byId.get(children.right) : null;
    const leftHeight = left?.height ?? 0;
    const rightHeight = right?.height ?? 0;
    assert.equal(
      node.height,
      1 + Math.max(leftHeight, rightHeight),
      `${label}: height of ${node.value} must match its children`,
    );
    assert.equal(
      node.balance,
      leftHeight - rightHeight,
      `${label}: balance of ${node.value} must match its children`,
    );
  }
}

function assertAvl(tree, label = '') {
  assertConsistentFields(tree, label);
  const state = tree.getState();
  const byId = new Map(state.nodes.map((node) => [node.id, node]));
  const kids = childMap(state);
  const seen = new Set();

  function walk(id, lower, upper) {
    if (id === null) return 0;
    assert.ok(!seen.has(id), `${label}: a node was visited twice`);
    seen.add(id);
    const node = byId.get(id);
    assert.ok(node, `${label}: a child id must reference a node`);
    assert.ok(node.value > lower && node.value < upper, `${label}: BST order broken at ${node.value}`);
    const children = kids.get(id) ?? {};
    const leftHeight = walk(children.left ?? null, lower, node.value);
    const rightHeight = walk(children.right ?? null, node.value, upper);
    assert.ok(Math.abs(leftHeight - rightHeight) <= 1, `${label}: node ${node.value} is unbalanced`);
    return 1 + Math.max(leftHeight, rightHeight);
  }

  if (state.root !== null) {
    assert.ok(byId.has(state.root), `${label}: root must reference a node`);
    walk(state.root, -Infinity, Infinity);
  }
  assert.equal(seen.size, state.nodes.length, `${label}: every node must be reachable from the root`);
  assert.equal(state.edges.length, Math.max(0, state.nodes.length - 1), `${label}: edge count`);

  const values = inOrderValues(state, kids);
  assert.deepEqual(
    values,
    [...values].sort((left, right) => left - right),
    `${label}: in-order traversal must be sorted`,
  );
  assert.deepEqual(state.nodes.map((node) => node.value), values, `${label}: node list must be in order`);
}

function assertWellFormed(steps) {
  for (const step of steps) {
    assert.equal(typeof step.type, 'string');
    assert.ok(step.type.length > 0);
    assert.equal(typeof step.message, 'string');
    assert.ok(step.message.endsWith('.'), step.message);
    assert.ok(Array.isArray(step.focus ?? []));
    for (const id of step.focus ?? []) assert.equal(typeof id, 'string');
  }
}

test('static metadata exposes id, title, group, layout and demo', () => {
  assert.equal(AvlTree.meta, meta);
  assert.equal(meta.id, 'avl');
  assert.equal(meta.title, 'AVL Tree');
  assert.equal(meta.group, 'Trees');
  assert.equal(meta.layout, 'tree');
  assert.deepEqual(meta.demo, [30, 20, 40, 10, 25, 35, 50]);
  assert.equal(typeof meta.description, 'string');
});

test('metadata declares Omega, Theta and Big O for every operation', () => {
  const notation = { best: 'Ω', average: 'Θ', worst: 'O' };
  for (const [name, operation] of Object.entries(meta.operations)) {
    assert.equal(typeof operation.description, 'string', name);
    assert.equal(typeof operation.signature, 'string', name);
    assert.equal(typeof operation.label, 'string', name);
    assert.ok(Array.isArray(operation.fields), name);
    for (const field of operation.fields) {
      assert.equal(field.type, 'number', `${name}.${field.name}`);
      assert.equal(typeof field.name, 'string');
      assert.equal(typeof field.label, 'string');
    }
    for (const [bound, prefix] of Object.entries(notation)) {
      assert.equal(typeof operation[bound].symbol, 'string', `${name}.${bound}`);
      assert.ok(operation[bound].symbol.startsWith(prefix), `${name}.${bound} must start with ${prefix}`);
      assert.ok(operation[bound].symbol.includes('log n'), `${name}.${bound} must be logarithmic`);
      assert.equal(typeof operation[bound].text, 'string', `${name}.${bound}`);
    }
  }
  const names = Object.keys(meta.operations);
  assert.deepEqual([...names].sort(), ['delete', 'insert', 'search']);
  for (const bound of ['best', 'average', 'worst']) {
    assert.ok(meta.rotation[bound].symbol.startsWith(notation[bound]));
    assert.ok(meta.rotation[bound].symbol.includes('1'));
  }
});

test('reset produces an empty state and empty operations miss', () => {
  const tree = new AvlTree().reset();
  assert.deepEqual(tree.getState(), { root: null, nodes: [], edges: [] });
  assert.equal(drain(tree.search(5)), false);
  assert.equal(drain(tree.delete(5)), false);
  assertAvl(tree, 'empty');
  for (const step of [...tree.search(1), ...tree.delete(1)]) {
    assert.equal(step.type, 'miss');
  }
});

test('seed builds the demo tree with balanced heights', () => {
  const tree = new AvlTree().reset(meta.demo);
  assertAvl(tree, 'demo seed');
  const state = tree.getState();
  const root = state.nodes.find((node) => node.id === state.root);
  assert.equal(root.value, 30);
  assert.deepEqual(inOrderValues(state), [10, 20, 25, 30, 35, 40, 50]);
});

test('insert keeps height, balance and sort order consistent after every insertion', () => {
  const tree = new AvlTree().reset();
  const values = [30, 20, 40, 10, 25, 35, 50, 5, 15, 27, 45, 60, 1];
  const expected = [];
  for (const value of values) {
    const steps = [...tree.insert(value)];
    assertWellFormed(steps);
    expected.push(value);
    expected.sort((left, right) => left - right);
    assert.deepEqual(inOrderValues(tree.getState()), expected);
    assertAvl(tree, `after inserting ${value}`);
  }
});

const rotationCases = [
  { name: 'LL', values: [30, 20, 10], root: 20 },
  { name: 'LR', values: [30, 10, 20], root: 20 },
  { name: 'RR', values: [10, 20, 30], root: 20 },
  { name: 'RL', values: [10, 30, 20], root: 20 },
];

for (const { name, values, root } of rotationCases) {
  test(`insert names the ${name} rotation in a rotate step`, () => {
    const tree = new AvlTree().reset();
    const steps = [...tree.insert(values[0]), ...tree.insert(values[1]), ...tree.insert(values[2])];
    assertWellFormed(steps);
    const rotations = steps.filter((step) => step.type === 'rotate');
    assert.equal(rotations.length, 1, `expected exactly one rotate step for ${name}`);
    assert.match(rotations[0].message, new RegExp(`\\(${name}\\)`));
    assert.match(rotations[0].message, /\.$/);
    assert.ok(rotations[0].message.includes('rotation'));
    assert.ok(rotations[0].focus.length > 0);
    const rootNode = tree.getState().nodes.find((node) => node.id === tree.getState().root);
    assert.equal(rootNode.value, root);
    assertAvl(tree, name);
  });
}

test('deletion rebalances with explicitly named rotations', () => {
  const values = [88, 24, 16, 28, 48, 92, 56, 12, 32, 84, 80, 13, 76, 68, 36, 72, 0];
  const leftHeavy = new AvlTree().reset(values);
  const rightHeavy = new AvlTree().reset(values);
  const steps = [...leftHeavy.delete(16), ...rightHeavy.delete(48)];
  assertWellFormed(steps);
  const rotations = steps.filter((step) => step.type === 'rotate');
  assert.ok(rotations.length >= 2, 'expected deletion to trigger rotations');
  for (const step of rotations) {
    assert.match(step.message, /\((LL|LR|RL|RR)\)/);
    assert.match(step.message, /rotation performed at node \d+\.$/);
  }
  assert.ok(rotations.some((step) => step.message.includes('(LL)')));
  assert.ok(rotations.some((step) => step.message.includes('(RL)')));
  assertAvl(leftHeavy, 'after LL deletion rotation');
  assertAvl(rightHeavy, 'after RL deletion rotation');
});

test('duplicate insert is ignored and reports a miss', () => {
  const tree = new AvlTree().reset([30, 20, 40]);
  const before = JSON.stringify(tree.getState());
  const steps = [...tree.insert(20)];
  assertWellFormed(steps);
  assert.ok(steps.some((step) => step.type === 'miss'));
  assert.ok(steps.some((step) => step.message.includes('already in the tree')));
  assert.equal(JSON.stringify(tree.getState()), before, 'duplicate insert must not mutate the tree');
  assert.equal(drain(tree.insert(20)), false);
  assertAvl(tree, 'after duplicate');
});

test('search returns true for present values and false for missing ones', () => {
  const tree = new AvlTree().reset(meta.demo);
  for (const value of [30, 10, 25, 50]) {
    const steps = [...tree.search(value)];
    assertWellFormed(steps);
    assert.ok(steps.some((step) => step.type === 'compare'));
    assert.equal(steps.at(-1).type, 'found');
    assert.match(steps.at(-1).message, new RegExp(`Found ${value} in the tree\\.`));
    assert.equal(drain(tree.search(value)), true);
  }
  for (const value of [1, 26, 99]) {
    const steps = [...tree.search(value)];
    assertWellFormed(steps);
    assert.equal(steps.at(-1).type, 'miss');
    assert.match(steps.at(-1).message, new RegExp(`${value} is not in the tree\\.`));
    assert.equal(drain(tree.search(value)), false);
  }
  const before = JSON.stringify(tree.getState());
  drain(tree.search(25));
  assert.equal(JSON.stringify(tree.getState()), before, 'search must not mutate the state');
  assertAvl(tree, 'after searches');
});

test('delete removes leaves, single-child nodes and two-child nodes', () => {
  const tree = new AvlTree().reset(meta.demo);
  // 50 is a leaf, 40 has a single left child after 50 is gone, 30 has two children.
  assert.equal(drain(tree.delete(50)), true);
  assertAvl(tree, 'after deleting a leaf');
  assert.equal(inOrderValues(tree.getState()).includes(50), false);

  assert.equal(drain(tree.delete(40)), true);
  assertAvl(tree, 'after deleting a one-child node');
  assert.equal(inOrderValues(tree.getState()).includes(40), false);

  assert.equal(drain(tree.delete(30)), true);
  assertAvl(tree, 'after deleting a two-child node');
  assert.deepEqual(inOrderValues(tree.getState()), [10, 20, 25, 35]);
});

test('delete with only a left child or only a right child keeps the child id', () => {
  const leftOnly = new AvlTree().reset([30, 20]);
  const leftOnlyState = leftOnly.getState();
  const leftChildId = leftOnlyState.edges.find((edge) => edge.from === leftOnlyState.root && edge.side === 'left').to;
  assert.equal(drain(leftOnly.delete(30)), true);
  assertAvl(leftOnly, 'left child promotion');
  assert.equal(leftOnly.getState().root, leftChildId);
  assert.deepEqual(inOrderValues(leftOnly.getState()), [20]);

  const rightOnly = new AvlTree().reset([10, 20]);
  const rightOnlyState = rightOnly.getState();
  const rightChildId = rightOnlyState.edges.find((edge) => edge.from === rightOnlyState.root && edge.side === 'right').to;
  assert.equal(drain(rightOnly.delete(10)), true);
  assertAvl(rightOnly, 'right child promotion');
  assert.equal(rightOnly.getState().root, rightChildId);
  assert.deepEqual(inOrderValues(rightOnly.getState()), [20]);
});

test('deleting the root of a one-node tree leaves an empty tree', () => {
  const tree = new AvlTree().reset([7]);
  const steps = [...tree.delete(7)];
  assertWellFormed(steps);
  assert.equal(steps.at(-1).type, 'done');
  assert.deepEqual(tree.getState(), { root: null, nodes: [], edges: [] });
  assertAvl(tree, 'emptied tree');
  assert.equal(drain(tree.search(7)), false);
});

test('deleting a missing value leaves the tree unchanged', () => {
  const tree = new AvlTree().reset(meta.demo);
  const before = JSON.stringify(tree.getState());
  const steps = [...tree.delete(999)];
  assertWellFormed(steps);
  assert.equal(steps.at(-1).type, 'miss');
  assert.equal(JSON.stringify(tree.getState()), before);
  assertAvl(tree, 'after deleting a missing value');
});

function assertReachable(tree, label) {
  const state = tree.getState();
  const ids = new Set(state.nodes.map((node) => node.id));
  const seen = new Set();
  const walk = (id) => {
    if (id === null || id === undefined) return;
    assert.ok(ids.has(id), `${label}: child id ${id} must exist`);
    if (seen.has(id)) return;
    seen.add(id);
    for (const edge of state.edges.filter((item) => item.from === id)) walk(edge.to);
  };
  walk(state.root);
  assert.equal(seen.size, state.nodes.length, `${label}: every node must be reachable from the root`);
}

test('every rotation step keeps the promoted subtree reachable from the root', () => {
  const cases = [
    { name: 'LL', inserts: [5, 1] },
    { name: 'RR', inserts: [35, 40] },
    { name: 'LR', inserts: [15, 12] },
    { name: 'RL', inserts: [25, 28] },
  ];
  for (const { name, inserts } of cases) {
    const tree = new AvlTree().reset([20, 10, 30]);
    for (const value of inserts.slice(0, -1)) {
      for (const _step of tree.insert(value)) { /* drain */ }
    }
    let rotated = false;
    for (const step of tree.insert(inserts.at(-1))) {
      if (step.type === 'rotate') rotated = true;
      assertReachable(tree, `${name} step ${step.type}`);
      const ids = new Set(tree.getState().nodes.map((node) => node.id));
      for (const id of step.focus) assert.ok(ids.has(id), `focus id ${id} must exist`);
    }
    assert.ok(rotated, `the ${name} scenario must trigger a rotation`);
  }
});

test('state snapshots stay consistent while steps are consumed', () => {
  const tree = new AvlTree().reset([30, 20, 40, 10, 25, 35, 50]);
  for (const operation of [
    tree.insert(5),
    tree.insert(12),
    tree.search(35),
    tree.search(999),
    tree.delete(20),
    tree.delete(5),
  ]) {
    for (const step of operation) {
      assertWellFormed([step]);
      assertConsistentFields(tree, `step ${step.type}`);
    }
  }
  assertAvl(tree, 'after stepped operations');
});

test('long mixed insert/delete sequence keeps the in-order sequence sorted', () => {
  const tree = new AvlTree().reset();
  const model = new Set();
  let seed = 987654321;
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed;
  };
  for (let index = 0; index < 150; index += 1) {
    const value = random() % 40;
    if (random() % 2 === 0) {
      drain(tree.insert(value));
      model.add(value);
    } else {
      drain(tree.delete(value));
      model.delete(value);
    }
    const expected = [...model].sort((left, right) => left - right);
    assert.deepEqual(inOrderValues(tree.getState()), expected, `mismatch at step ${index}`);
    assertAvl(tree, `mixed step ${index}`);
  }
});

test('ids are stable, unique and restart after reset', () => {
  const tree = new AvlTree().reset([30, 20, 40]);
  const state = tree.getState();
  const ids = state.nodes.map((node) => node.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => id.startsWith('n')));
  assert.equal(state.root, 'n1');
  assert.equal(drain(tree.delete(40)), true);
  const remaining = new Set(tree.getState().nodes.map((node) => node.id));
  assert.ok(remaining.has('n1') && remaining.has('n2'));
  assert.ok(!remaining.has('n3'));
  tree.reset([8]);
  assert.equal(tree.getState().root, 'n1');
  assert.deepEqual(inOrderValues(tree.getState()), [8]);
  assert.equal(tree.getState().nodes.length, 1);
});

test('insert and delete generators expose their final boolean result', () => {
  const tree = new AvlTree().reset();
  assert.equal(drain(tree.insert(4)), true);
  assert.equal(drain(tree.insert(4)), false);
  assert.equal(drain(tree.delete(4)), true);
  assert.equal(drain(tree.delete(4)), false);
});
