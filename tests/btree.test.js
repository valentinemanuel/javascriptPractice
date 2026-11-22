import test from 'node:test';
import assert from 'node:assert/strict';
import { BTree, meta } from '../js/structures/btree.js';

function run(iterator) {
  let result = iterator.next();
  const steps = [];
  while (!result.done) {
    steps.push(result.value);
    result = iterator.next();
  }
  return { steps, value: result.value };
}

function childIds(state, id) {
  return state.edges
    .filter((edge) => edge.from === id)
    .sort((a, b) => a.index - b.index)
    .map((edge) => edge.to);
}

function inOrderKeys(state) {
  const byId = new Map(state.nodes.map((node) => [node.id, node]));
  const result = [];
  function visit(id) {
    const node = byId.get(id);
    const children = childIds(state, id);
    node.keys.forEach((key, index) => {
      if (children[index]) visit(children[index]);
      result.push(key);
    });
    if (children.length > 0) visit(children.at(-1));
  }
  if (state.root !== null) visit(state.root);
  return result;
}

function assertInvariants(tree) {
  const state = tree.getState();
  const byId = new Map(state.nodes.map((node) => [node.id, node]));
  assert.equal(state.order, tree.order);
  assert.equal(state.nodes.length, byId.size, 'node ids must be unique');

  if (state.root === null) {
    assert.equal(state.nodes.length, 0, 'an empty tree has no nodes');
    assert.equal(state.edges.length, 0, 'an empty tree has no edges');
    return;
  }
  assert.ok(byId.has(state.root), 'the root must exist');

  const depths = [];
  function visit(id, depth, lower, upper) {
    const node = byId.get(id);
    assert.ok(node, `missing node ${id}`);
    for (let i = 1; i < node.keys.length; i += 1) {
      assert.ok(node.keys[i - 1] < node.keys[i], `keys must be strictly sorted in ${id}`);
    }
    if (id === state.root) {
      assert.ok(node.keys.length >= 1 && node.keys.length <= tree.maxKeys, 'root key bounds');
    } else {
      assert.ok(
        node.keys.length >= tree.minKeys && node.keys.length <= tree.maxKeys,
        `non-root key bounds violated in ${id}: ${node.keys}`,
      );
    }
    const children = childIds(state, id);
    if (node.leaf) {
      assert.equal(children.length, 0, `leaf ${id} must not have children`);
    } else {
      assert.equal(children.length, node.keys.length + 1, `internal ${id} child count`);
    }
    for (const key of node.keys) {
      if (lower !== null) assert.ok(key > lower, `key ${key} must exceed ${lower}`);
      if (upper !== null) assert.ok(key < upper, `key ${key} must be below ${upper}`);
    }
    children.forEach((childId, index) => {
      const childLower = index === 0 ? lower : node.keys[index - 1];
      const childUpper = index === children.length - 1 ? upper : node.keys[index];
      visit(childId, depth + 1, childLower, childUpper);
    });
    if (node.leaf) depths.push(depth);
  }
  visit(state.root, 0, null, null);
  assert.equal(new Set(depths).size, 1, 'every leaf must be at the same depth');

  const incoming = new Map(state.nodes.map((node) => [node.id, 0]));
  const outgoingIndices = new Map();
  for (const edge of state.edges) {
    assert.ok(byId.has(edge.from), `dangling edge source ${edge.from}`);
    assert.ok(byId.has(edge.to), `dangling edge target ${edge.to}`);
    const key = `${edge.from}:${edge.index}`;
    assert.ok(!outgoingIndices.has(key), `duplicate child index ${key}`);
    outgoingIndices.set(key, true);
    incoming.set(edge.to, incoming.get(edge.to) + 1);
  }
  for (const node of state.nodes) {
    const expected = node.id === state.root ? 0 : 1;
    assert.equal(incoming.get(node.id), expected, `incoming edge count for ${node.id}`);
    const indices = state.edges
      .filter((edge) => edge.from === node.id)
      .map((edge) => edge.index)
      .sort((a, b) => a - b);
    assert.deepEqual(indices, indices.map((_, index) => index), 'child indices must be contiguous');
  }
}

function assertWellFormed(steps) {
  for (const step of steps) {
    assert.equal(typeof step.type, 'string');
    assert.ok(step.type.length > 0, 'step type must not be empty');
    assert.equal(typeof step.message, 'string');
    assert.ok(step.message.endsWith('.'), step.message);
    assert.ok(Array.isArray(step.focus ?? []), 'focus must be an array');
    for (const id of step.focus ?? []) assert.equal(typeof id, 'string');
    assert.ok(step.payload === undefined || typeof step.payload === 'object');
  }
}

test('initial state is an empty tree', () => {
  const tree = new BTree();
  assert.deepEqual(tree.getState(), { order: 4, root: null, nodes: [], edges: [] });
  assert.equal(tree.t, 2);
  assert.equal(tree.minKeys, 1);
  assert.equal(tree.maxKeys, 3);
  assertInvariants(tree);
});

test('seed builds the demo tree and search finds every inserted key', () => {
  const tree = new BTree().seed(meta.demo);
  assert.equal(tree.getState().root !== null, true);
  assert.deepEqual(inOrderKeys(tree.getState()), [...meta.demo].sort((a, b) => a - b));
  for (const key of meta.demo) assert.equal(run(tree.search(key)).value, true, `search ${key}`);
  assertInvariants(tree);
});

test('insert splits a full root bottom-up and yields visit and split steps', () => {
  const tree = new BTree();
  for (const key of [1, 2, 3]) run(tree.insert(key));
  assert.equal(tree.getState().nodes.length, 1);

  const { steps, value } = run(tree.insert(4));
  assert.equal(value, 4);
  assert.ok(steps.some((step) => step.type === 'visit'));
  assert.ok(steps.some((step) => step.type === 'split'));
  assert.ok(steps.some((step) => step.type === 'insert'));
  const state = tree.getState();
  assert.equal(state.nodes.find((node) => node.id === state.root).keys.length, 1);
  assert.equal(childIds(state, state.root).length, 2);
  assert.deepEqual(inOrderKeys(state), [1, 2, 3, 4]);
  assertInvariants(tree);
});

test('all nodes keep sorted keys and balanced shape through many inserts', () => {
  const tree = new BTree();
  const inserted = [];
  for (let key = 1; key <= 40; key += 1) {
    run(tree.insert(key));
    inserted.push(key);
    assertInvariants(tree);
    assert.deepEqual(inOrderKeys(tree.getState()), inserted);
  }
  assert.ok(tree.getState().nodes.length > 1, 'inserts must create multiple nodes');
});

test('search reports found and miss with compare steps without mutating state', () => {
  const tree = new BTree().seed(meta.demo);
  const before = JSON.stringify(tree.getState());
  const hit = run(tree.search(12));
  assert.equal(hit.value, true);
  assert.ok(hit.steps.some((step) => step.type === 'compare'));
  assert.ok(hit.steps.some((step) => step.type === 'found'));

  const miss = run(tree.search(999));
  assert.equal(miss.value, false);
  assert.ok(miss.steps.some((step) => step.type === 'miss'));
  assert.equal(JSON.stringify(tree.getState()), before, 'search must not mutate the tree');
});

test('duplicate keys are ignored', () => {
  const tree = new BTree().seed([5, 3, 8]);
  const before = JSON.stringify(tree.getState());
  const { steps, value } = run(tree.insert(3));
  assert.equal(value, null);
  assert.ok(steps.some((step) => step.type === 'miss'));
  assert.equal(JSON.stringify(tree.getState()), before);
  assert.deepEqual(inOrderKeys(tree.getState()), [3, 5, 8]);
});

test('invalid keys are rejected on empty and non-empty trees', () => {
  const empty = new BTree();
  assert.equal(run(empty.search('abc')).value, false);
  assert.equal(run(empty.delete('abc')).value, false);
  assert.equal(run(empty.insert('abc')).value, null);
  assertInvariants(empty);

  const tree = new BTree().seed([1, 2]);
  const before = JSON.stringify(tree.getState());
  assert.equal(run(tree.insert(Number.NaN)).value, null);
  assert.equal(run(tree.delete(Number.NaN)).value, false);
  assert.equal(JSON.stringify(tree.getState()), before);
});

test('delete removes a key from a leaf', () => {
  const tree = new BTree().seed([1, 2, 3, 4, 5]);
  const { steps, value } = run(tree.delete(1));
  assert.equal(value, true);
  assert.ok(steps.some((step) => step.type === 'delete'));
  assert.equal(run(tree.search(1)).value, false);
  assert.deepEqual(inOrderKeys(tree.getState()), [2, 3, 4, 5]);
  assertInvariants(tree);
});

test('delete removes an internal key from the root using a successor', () => {
  const tree = new BTree().seed(Array.from({ length: 15 }, (_, i) => i + 1));
  const { steps, value } = run(tree.delete(9));
  assert.equal(value, true);
  assert.ok(steps.some((step) => step.type === 'access'));
  assert.equal(run(tree.search(9)).value, false);
  assert.deepEqual(
    inOrderKeys(tree.getState()),
    Array.from({ length: 15 }, (_, i) => i + 1).filter((key) => key !== 9),
  );
  assertInvariants(tree);
});

test('delete removes an internal key from a non-root node', () => {
  const tree = new BTree().seed(Array.from({ length: 15 }, (_, i) => i + 1));
  const { value } = run(tree.delete(3));
  assert.equal(value, true);
  assert.equal(run(tree.search(3)).value, false);
  const state = tree.getState();
  assert.ok(state.nodes.some((node) => !node.leaf && node.keys.includes(3) === false));
  assertInvariants(tree);
});

test('deleting the last leaf root key leaves a properly empty tree', () => {
  const tree = new BTree().seed([10]);
  const { value } = run(tree.delete(10));
  assert.equal(value, true);
  assert.deepEqual(tree.getState(), { order: 4, root: null, nodes: [], edges: [] });
  assert.equal(run(tree.search(10)).value, false);
  assertInvariants(tree);
});

test('deleting a missing key reports a miss and leaves the tree valid', () => {
  const tree = new BTree().seed([10, 20, 5, 6, 12, 30, 7, 17]);
  const before = inOrderKeys(tree.getState());
  const { steps, value } = run(tree.delete(999));
  assert.equal(value, false);
  assert.ok(steps.some((step) => step.type === 'miss'));
  assert.deepEqual(inOrderKeys(tree.getState()), before);
  assertInvariants(tree);
});

test('delete borrows from a left sibling when a child is underfull', () => {
  const tree = new BTree().seed(Array.from({ length: 15 }, (_, i) => i + 1));
  const { steps, value } = run(tree.delete(11));
  assert.equal(value, true);
  const borrow = steps.find((step) => step.type === 'borrow');
  assert.ok(borrow, 'a borrow step must be yielded');
  assert.match(borrow.message, /left sibling/);
  assert.equal(run(tree.search(11)).value, false);
  assertInvariants(tree);
});

test('delete borrows from a right sibling when a child is underfull', () => {
  const tree = new BTree().seed([28, 20, 14, 4, 12, 22, 8, 0, 26, 10]);
  const { steps, value } = run(tree.delete(14));
  assert.equal(value, true);
  const borrow = steps.find((step) => step.type === 'borrow');
  assert.ok(borrow, 'a borrow step must be yielded');
  assert.match(borrow.message, /right sibling/);
  assert.equal(run(tree.search(14)).value, false);
  assert.deepEqual(inOrderKeys(tree.getState()), [0, 4, 8, 10, 12, 20, 22, 26, 28]);
  assertInvariants(tree);
});

test('delete merges minimal siblings and reduces the node count', () => {
  const tree = new BTree().seed([4, 12, 6, 18, 8, 2]);
  const before = tree.getState().nodes.length;
  assert.equal(before, 4);
  const { steps, value } = run(tree.delete(12));
  assert.equal(value, true);
  const merge = steps.find((step) => step.type === 'merge');
  assert.ok(merge, 'a merge step must be yielded');
  assert.match(merge.message, /Merged node/);
  assert.ok(tree.getState().nodes.length < before, 'merge must remove a node');
  assert.deepEqual(inOrderKeys(tree.getState()), [2, 4, 6, 8, 18]);
  assertInvariants(tree);
});

test('deleting every key in turn keeps the tree consistent', () => {
  const values = [10, 20, 5, 6, 12, 30, 7, 17];
  const tree = new BTree().seed(values);
  for (const key of values) {
    assert.equal(run(tree.delete(key)).value, true, `delete ${key}`);
    assertInvariants(tree);
  }
  assert.equal(tree.getState().root, null);
  assert.deepEqual(inOrderKeys(tree.getState()), []);
});

test('ids are stable, unique, prefixed with b, and reset with the structure', () => {
  const tree = new BTree().seed([1, 2, 3, 4]);
  const ids = tree.getState().nodes.map((node) => node.id);
  assert.ok(ids.every((id) => /^b\d+$/.test(id)));
  assert.equal(new Set(ids).size, ids.length);
  tree.reset([7]);
  assert.equal(tree.getState().nodes[0].id, 'b1');
  assert.deepEqual(inOrderKeys(tree.getState()), [7]);
});

test('larger orders and odd orders are handled deterministically', () => {
  const six = new BTree(6);
  assert.equal(six.order, 6);
  assert.equal(six.minKeys, 2);
  for (let key = 1; key <= 25; key += 1) run(six.insert(key));
  assertInvariants(six);

  const normalized = new BTree(5);
  assert.equal(normalized.order, 6, 'odd orders are rounded up to an even order');
  assert.equal(normalized.getState().order, 6);
  assertInvariants(normalized);
});

test('the class exposes static metadata for the app shell', () => {
  assert.equal(BTree.meta, meta);
  assert.equal(meta.id, 'btree');
  assert.equal(meta.title, 'B-Tree');
  assert.equal(meta.group, 'Trees');
  assert.equal(meta.layout, 'multiKey');
  assert.deepEqual(meta.demo, [10, 20, 5, 6, 12, 30, 7, 17]);
  assert.deepEqual(Object.keys(meta.operations), ['insert', 'search', 'delete']);
  assert.equal(typeof meta.description, 'string');
});

test('metadata declares fields and Omega, Theta and Big O for every operation', () => {
  const notation = { best: 'Ω', average: 'Θ', worst: 'O' };
  for (const [name, operation] of Object.entries(meta.operations)) {
    assert.equal(typeof operation.description, 'string', name);
    assert.equal(typeof operation.signature, 'string', name);
    assert.deepEqual(
      operation.fields,
      [{ name: 'key', label: 'Key', type: 'number', placeholder: 'e.g. 10' }],
      name,
    );
    for (const [bound, prefix] of Object.entries(notation)) {
      assert.equal(typeof operation[bound].symbol, 'string', `${name}.${bound}`);
      assert.ok(operation[bound].symbol.startsWith(prefix), `${name}.${bound} prefix`);
      assert.equal(typeof operation[bound].text, 'string', `${name}.${bound}`);
      assert.match(operation[bound].text, /m = order/, `${name}.${bound} must mention m = order`);
    }
  }
});

test('every yielded step is well formed', () => {
  const values = [10, 20, 5, 6, 12, 30, 7, 17];
  const tree = new BTree().seed(values);
  const operations = [
    tree.insert(13),
    tree.search(12),
    tree.search(999),
    tree.delete(6),
    tree.delete(999),
  ];
  for (const operation of operations) assertWellFormed([...operation].map((step) => step));
});

test('a deterministic random workload preserves all invariants', () => {
  let seed = 12345;
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed;
  };
  for (let trial = 0; trial < 12; trial += 1) {
    const order = [4, 6, 8][trial % 3];
    const tree = new BTree(order);
    const expected = new Set();
    for (let i = 0; i < 45; i += 1) {
      const key = 1 + (random() % 40);
      const duplicate = expected.has(key);
      assert.equal(run(tree.insert(key)).value, duplicate ? null : key);
      expected.add(key);
      assertInvariants(tree);
      assert.deepEqual(inOrderKeys(tree.getState()), [...expected].sort((a, b) => a - b));
    }
    for (let i = 0; i < 35; i += 1) {
      const key = 1 + (random() % 40);
      const shouldExist = expected.has(key);
      assert.equal(run(tree.delete(key)).value, shouldExist, `delete ${key}`);
      if (shouldExist) expected.delete(key);
      assertInvariants(tree);
      assert.deepEqual(inOrderKeys(tree.getState()), [...expected].sort((a, b) => a - b));
      assert.equal(run(tree.search(key)).value, false);
    }
  }
});
