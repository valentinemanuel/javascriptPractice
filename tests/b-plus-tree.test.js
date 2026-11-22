import test from 'node:test';
import assert from 'node:assert/strict';
import { BPlusTree, meta } from '../js/structures/b-plus-tree.js';

function run(iterator) {
  let result = iterator.next();
  while (!result.done) result = iterator.next();
  return result.value;
}

function collect(iterator) {
  const steps = [];
  let result = iterator.next();
  while (!result.done) {
    steps.push(result.value);
    result = iterator.next();
  }
  return { steps, result: result.value };
}

function nodeById(state, id) {
  return state.nodes.find((node) => node.id === id) ?? null;
}

function childrenOf(state, id) {
  return state.edges
    .filter((edge) => edge.from === id)
    .sort((a, b) => a.index - b.index)
    .map((edge) => edge.to);
}

function leftmostLeaf(state) {
  let id = state.root;
  while (id !== null && !nodeById(state, id).leaf) {
    id = childrenOf(state, id)[0];
  }
  return nodeById(state, id);
}

function chainLeaves(state) {
  const leaves = [];
  const seen = new Set();
  let current = leftmostLeaf(state);
  while (current !== null) {
    assert.ok(!seen.has(current.id), `leaf ${current.id} appears twice in the chain`);
    seen.add(current.id);
    leaves.push(current);
    current = current.next === null ? null : nodeById(state, current.next);
  }
  return leaves;
}

function allLeavesByTree(state) {
  const leaves = [];
  const stack = [state.root].filter((id) => id !== null);
  while (stack.length > 0) {
    const id = stack.pop();
    const node = nodeById(state, id);
    assert.ok(node, `node ${id} exists`);
    if (node.leaf) {
      leaves.push(node);
    } else {
      stack.push(...childrenOf(state, id));
    }
  }
  return leaves;
}

function subtreeKeys(state, id) {
  const node = nodeById(state, id);
  if (node.leaf) return [...node.keys];
  return childrenOf(state, id).flatMap((childId) => subtreeKeys(state, childId));
}

function minSubtreeKey(state, id) {
  return Math.min(...subtreeKeys(state, id));
}

function leafDepths(state) {
  const depths = [];
  const stack = [[state.root, 0]].filter(([id]) => id !== null);
  while (stack.length > 0) {
    const [id, depth] = stack.pop();
    const node = nodeById(state, id);
    if (node.leaf) {
      depths.push(depth);
    } else {
      for (const childId of childrenOf(state, id)) stack.push([childId, depth + 1]);
    }
  }
  return depths;
}

/** Checks every B+ tree invariant we rely on. */
function validateStructure(tree) {
  const state = tree.getState();
  const maxKeys = state.order - 1;
  const minKeys = Math.floor(maxKeys / 2);
  const ids = state.nodes.map((node) => node.id);
  assert.equal(new Set(ids).size, ids.length, 'node ids are unique');

  for (const node of state.nodes) {
    assert.ok(Array.isArray(node.keys), `${node.id} has a keys array`);
    assert.equal(typeof node.leaf, 'boolean', `${node.id} declares leaf`);
    assert.ok('next' in node, `${node.id} declares next`);
    assert.ok(node.keys.length <= maxKeys, `${node.id} does not overflow`);
    for (let i = 1; i < node.keys.length; i += 1) {
      assert.ok(node.keys[i - 1] < node.keys[i], `${node.id} keys are strictly increasing`);
    }
    if (node.next !== null) {
      assert.ok(nodeById(state, node.next), `next of ${node.id} points to an existing node`);
      assert.ok(nodeById(state, node.next).leaf, `next of ${node.id} points to a leaf`);
    }
  }

  if (state.root === null) {
    assert.equal(state.nodes.length, 0, 'an empty tree has no nodes');
    assert.equal(state.edges.length, 0, 'an empty tree has no edges');
    return [];
  }

  assert.ok(nodeById(state, state.root), 'the root exists');
  const incoming = new Map(state.nodes.map((node) => [node.id, 0]));
  for (const edge of state.edges) {
    assert.ok(nodeById(state, edge.from), `edge parent ${edge.from} exists`);
    assert.ok(nodeById(state, edge.to), `edge child ${edge.to} exists`);
    assert.ok(!nodeById(state, edge.from).leaf, 'only internal nodes have child edges');
    incoming.set(edge.to, incoming.get(edge.to) + 1);
  }
  for (const node of state.nodes) {
    assert.equal(incoming.get(node.id), node.id === state.root ? 0 : 1, `${node.id} has one parent unless it is the root`);
  }

  for (const node of state.nodes) {
    const childIds = childrenOf(state, node.id);
    const indices = state.edges.filter((edge) => edge.from === node.id).map((edge) => edge.index);
    assert.deepEqual(indices, childIds.map((_id, index) => index), `${node.id} edge indices are contiguous`);
    if (node.leaf) {
      assert.equal(childIds.length, 0, `leaf ${node.id} has no children`);
    } else {
      assert.equal(childIds.length, node.keys.length + 1, `${node.id} has keys + 1 children`);
      assert.ok(node.keys.length >= 1, `${node.id} has at least one separator`);
      if (node.id !== state.root) {
        assert.ok(node.keys.length >= minKeys, `${node.id} has at least the minimum separators`);
      }
      for (let i = 1; i < childIds.length; i += 1) {
        assert.equal(node.keys[i - 1], minSubtreeKey(state, childIds[i]), `separator ${i - 1} of ${node.id} is the minimum of its right child`);
      }
    }
  }

  const leaves = chainLeaves(state);
  const byTree = allLeavesByTree(state);
  assert.equal(leaves.length, byTree.length, 'the leaf chain contains every leaf');
  assert.deepEqual(leaves.map((leaf) => leaf.id).sort(), byTree.map((leaf) => leaf.id).sort(), 'chain and tree leaves match');
  assert.equal(leaves.at(-1).next, null, 'the last leaf terminates the chain');

  const values = leaves.flatMap((leaf) => leaf.keys);
  assert.deepEqual(values, [...values].sort((a, b) => a - b), 'linked leaf values are globally sorted');
  for (const leaf of leaves) {
    assert.ok(leaf.keys.length >= minKeys || leaf.id === state.root, `leaf ${leaf.id} has at least the minimum keys`);
  }

  const depths = leafDepths(state);
  assert.equal(new Set(depths).size, 1, 'all leaves are at the same depth');
  return values;
}

test('the class exposes static metadata for the app shell', () => {
  assert.equal(BPlusTree.meta, meta);
  assert.equal(meta.id, 'b-plus-tree');
  assert.equal(meta.title, 'B+ Tree');
  assert.equal(meta.group, 'Trees');
  assert.equal(meta.layout, 'multiKey');
  assert.deepEqual(meta.demo, [5, 10, 15, 20, 25, 30, 35]);
});

test('metadata declares Omega, Theta and Big O for every operation', () => {
  const notation = { best: 'Ω', average: 'Θ', worst: 'O' };
  assert.deepEqual(Object.keys(meta.operations), ['insert', 'search', 'rangeQuery', 'delete']);
  for (const [name, operation] of Object.entries(meta.operations)) {
    assert.equal(typeof operation.description, 'string', name);
    for (const [bound, prefix] of Object.entries(notation)) {
      assert.equal(typeof operation[bound].symbol, 'string', `${name}.${bound}`);
      assert.ok(operation[bound].symbol.startsWith(prefix), `${name}.${bound} must start with ${prefix}`);
      assert.equal(typeof operation[bound].text, 'string', `${name}.${bound}`);
    }
  }
  assert.ok(meta.operations.rangeQuery.best.symbol.includes('+ k'));
  assert.ok(meta.operations.search.best.symbol.includes('log_m n'));
  assert.match(meta.description, /borrow|merge/i, 'the description documents the deletion strategy');
  assert.match(meta.description, /duplicate|even order/i, 'the description documents simplifications');
});

test('metadata declares argument fields in order', () => {
  assert.deepEqual(meta.operations.insert.fields.map((field) => field.name), ['key']);
  assert.deepEqual(meta.operations.search.fields.map((field) => field.name), ['key']);
  assert.deepEqual(meta.operations.rangeQuery.fields.map((field) => field.name), ['low', 'high']);
  assert.deepEqual(meta.operations.delete.fields.map((field) => field.name), ['key']);
  for (const operation of Object.values(meta.operations)) {
    for (const field of operation.fields ?? []) {
      assert.ok(['number', 'string'].includes(field.type));
      assert.equal(typeof field.label, 'string');
    }
  }
});

test('reset produces a valid empty structure and seed builds a valid tree', () => {
  const tree = new BPlusTree().reset();
  assert.deepEqual(tree.getState(), { order: 4, root: null, nodes: [], edges: [] });
  validateStructure(tree);

  tree.seed(meta.demo);
  assert.equal(tree.getState().order, 4);
  assert.notEqual(tree.getState().root, null);
  assert.deepEqual(validateStructure(tree), [...meta.demo].sort((a, b) => a - b));
});

test('the constructor accepts a custom even order', () => {
  const tree = new BPlusTree(6).seed([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(tree.getState().order, 6);
  assert.deepEqual(validateStructure(tree), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('insert splits leaves and propagates separators while keeping invariants', () => {
  const tree = new BPlusTree();
  for (const key of [10, 20, 5, 35, 30, 25, 15, 40, 45, 50]) {
    const { steps } = collect(tree.insert(key));
    assert.ok(steps.some((step) => step.type === 'insert'), `insert of ${key} yields an insert step`);
    assert.equal(steps.at(-1).type, 'done');
    validateStructure(tree);
  }
  const values = validateStructure(tree);
  assert.deepEqual(values, [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
  assert.ok(tree.getState().nodes.some((node) => !node.leaf), 'the tree grew internal nodes');
  const split = collect(new BPlusTree().insert(1)).steps;
  assert.ok(split.every((step) => typeof step.message === 'string' && step.message.endsWith('.')));
});

test('insert yields explicit split steps when nodes overflow', () => {
  const tree = new BPlusTree().seed([5, 10, 15, 20]);
  const root = tree.getState().root;
  assert.ok(root !== null && !nodeById(tree.getState(), root).leaf, 'the root became internal after a leaf split');
  const allSteps = [];
  for (const key of [25, 30, 35, 40, 45, 50, 55]) {
    allSteps.push(...collect(tree.insert(key)).steps.map((step) => step.type));
  }
  assert.ok(allSteps.includes('split'), 'split steps are reported during insertion');
  validateStructure(tree);
});

test('duplicate inserts are ignored', () => {
  const tree = new BPlusTree().seed([5, 10, 15, 20, 25]);
  const before = validateStructure(tree);
  const { steps, result } = collect(tree.insert(15));
  assert.equal(result, null);
  assert.ok(steps.some((step) => step.type === 'miss'));
  assert.deepEqual(validateStructure(tree), before);
});

test('search reports found and missing keys with descent steps', () => {
  const tree = new BPlusTree().seed(meta.demo);
  const found = collect(tree.search(25));
  assert.equal(found.result !== null, true);
  assert.ok(found.steps.some((step) => step.type === 'compare'), 'descent yields compare steps');
  assert.equal(found.steps.at(-1).type, 'found');
  assert.deepEqual(validateStructure(tree), [5, 10, 15, 20, 25, 30, 35]);

  const missing = collect(tree.search(99));
  assert.equal(missing.result, null);
  assert.equal(missing.steps.at(-1).type, 'miss');
  const below = collect(tree.search(1));
  assert.equal(below.result, null);
});

test('search on an empty tree yields a miss', () => {
  const tree = new BPlusTree().reset();
  const { steps, result } = collect(tree.search(7));
  assert.equal(result, null);
  assert.equal(steps[0].type, 'miss');
  assert.deepEqual(steps[0].focus, []);
});

test('range query scans across multiple leaves in sorted order', () => {
  const tree = new BPlusTree().seed([5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
  const { steps, result } = collect(tree.rangeQuery(12, 42));
  assert.deepEqual(result, [15, 20, 25, 30, 35, 40]);
  assert.ok(steps.filter((step) => step.type === 'visit').length >= 2, 'more than one leaf is visited');
  assert.equal(steps.filter((step) => step.type === 'found').length, 6);
  assert.equal(steps.at(-1).type, 'done');
  assert.deepEqual(validateStructure(tree), [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);

  const inclusive = run(tree.rangeQuery(20, 25));
  assert.deepEqual(inclusive, [20, 25]);
});

test('range query handles empty ranges and invalid bounds', () => {
  const tree = new BPlusTree().seed(meta.demo);
  assert.deepEqual(run(tree.rangeQuery(8, 9)), []);
  assert.deepEqual(run(tree.rangeQuery(100, 200)), []);
  assert.deepEqual(run(tree.rangeQuery(40, 10)), []);
  const { steps } = collect(tree.rangeQuery(8, 9));
  assert.equal(steps.at(-1).type, 'miss');
  const emptyTree = new BPlusTree().reset();
  assert.deepEqual(run(emptyTree.rangeQuery(1, 2)), []);
});

test('delete merges an underfull leaf with a sibling and fixes separators', () => {
  const tree = new BPlusTree().seed([5, 10, 15, 20, 25, 30]);
  run(tree.delete(10)); // first leaf becomes [5]
  run(tree.delete(20)); // middle leaf becomes [15]
  const { steps, result } = collect(tree.delete(5));
  assert.equal(result, 5);
  assert.ok(steps.some((step) => step.type === 'delete'));
  assert.ok(
    steps.some((step) => step.type === 'merge' && step.message.startsWith('Merged leaf')),
    'two minimally filled leaves are merged',
  );
  assert.equal(steps.at(-1).type, 'done');
  assert.deepEqual(validateStructure(tree), [15, 25, 30]);
});

test('delete borrows from a sibling when possible', () => {
  const tree = new BPlusTree().seed([5, 10, 15, 20, 25]);
  run(tree.delete(5)); // first leaf becomes [10], still valid
  const { steps, result } = collect(tree.delete(10));
  // The first leaf is now empty while its right sibling [15, 20, 25] can lend.
  assert.equal(result, 10);
  assert.ok(
    steps.some((step) => step.type === 'merge' && step.message.includes('Borrowed key')),
    'a key is borrowed from the right sibling',
  );
  assert.deepEqual(validateStructure(tree), [15, 20, 25]);
});

test('delete borrows a child between internal nodes without duplicating parents', () => {
  const tree = new BPlusTree(4);
  for (let key = 1; key <= 12; key += 1) run(tree.insert(key));
  validateStructure(tree);

  let borrowedInternally = false;
  for (const key of [1, 2, 3, 4, 5]) {
    const { steps } = collect(tree.delete(key));
    if (steps.some((step) => step.message.includes('sibling of internal node'))) {
      borrowedInternally = true;
    }
    validateStructure(tree);
    const incoming = new Map();
    for (const edge of tree.getState().edges) {
      incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    }
    for (const count of incoming.values()) assert.equal(count, 1);
  }
  assert.ok(borrowedInternally, 'the scenario must exercise an internal child borrow');
});

test('delete handles root keys, missing keys and repeated deletions', () => {
  const tree = new BPlusTree().seed(meta.demo);
  assert.equal(run(tree.delete(15)), 15);
  validateStructure(tree);
  assert.equal(run(tree.delete(15)), null, 'deleting twice is a miss');
  validateStructure(tree);
  assert.equal(run(tree.delete(999)), null);
  validateStructure(tree);
  assert.deepEqual(validateStructure(tree), [5, 10, 20, 25, 30, 35]);

  const empty = new BPlusTree().reset();
  assert.equal(run(empty.delete(3)), null);
  validateStructure(empty);
});

test('deleting every key repeatedly leaves a valid structure', () => {
  const values = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
  const tree = new BPlusTree().seed(values);
  const order = [25, 5, 50, 10, 35, 20, 40, 15, 30, 45];
  for (const key of order) {
    assert.equal(run(tree.delete(key)), key, `deleted ${key}`);
    validateStructure(tree);
  }
  assert.deepEqual(validateStructure(tree), []);
  // The tree can be reused after being emptied.
  tree.seed([7, 8]);
  assert.deepEqual(validateStructure(tree), [7, 8]);
});

test('mixed insert and delete sequences preserve all invariants', () => {
  const tree = new BPlusTree();
  let expected = [];
  const sequence = [
    ['i', 40], ['i', 10], ['i', 20], ['i', 30], ['i', 50], ['i', 5],
    ['i', 15], ['i', 25], ['i', 35], ['i', 45], ['i', 55], ['i', 60],
    ['d', 10], ['d', 30], ['d', 50], ['i', 1], ['i', 3], ['i', 2],
    ['d', 5], ['d', 60], ['i', 70], ['d', 40], ['d', 25],
  ];
  for (const [action, key] of sequence) {
    if (action === 'i') {
      run(tree.insert(key));
      expected.push(key);
    } else {
      run(tree.delete(key));
      expected = expected.filter((value) => value !== key);
    }
    expected.sort((a, b) => a - b);
    assert.deepEqual(validateStructure(tree), expected, `after ${action}(${key})`);
  }
});

test('ids are stable, unique and reset with the structure', () => {
  const tree = new BPlusTree().seed([1, 2, 3]);
  const ids = tree.getState().nodes.map((node) => node.id);
  assert.ok(ids.every((id) => id.startsWith('bp')), 'ids use the bp prefix');
  assert.equal(new Set(ids).size, ids.length);
  tree.reset([9]);
  assert.equal(tree.getState().root, 'bp1');
  assert.deepEqual(validateStructure(tree), [9]);
});

test('getState returns the live canonical state shape', () => {
  const tree = new BPlusTree().seed([1]);
  const state = tree.getState();
  assert.deepEqual(Object.keys(state).sort(), ['edges', 'nodes', 'order', 'root']);
  assert.ok(Array.isArray(state.nodes));
  assert.ok(Array.isArray(state.edges));
  assert.equal(state.order, 4);
});

test('every yielded step from every operation is well formed', () => {
  const tree = new BPlusTree().seed([5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
  const operations = [
    tree.insert(27),
    tree.search(20),
    tree.search(999),
    tree.rangeQuery(10, 40),
    tree.rangeQuery(100, 200),
    tree.delete(20),
    tree.delete(999),
  ];
  const ids = () => new Set(tree.getState().nodes.map((node) => node.id));
  for (const operation of operations) {
    for (const step of operation) {
      assert.equal(typeof step.type, 'string');
      assert.ok(step.type.length > 0);
      assert.equal(typeof step.message, 'string');
      assert.ok(step.message.endsWith('.'), step.message);
      assert.ok(!step.message.includes('undefined'), step.message);
      for (const id of step.focus ?? []) {
        assert.equal(typeof id, 'string');
        assert.ok(ids().has(id), `focus id ${id} exists in the state`);
      }
    }
  }
});
