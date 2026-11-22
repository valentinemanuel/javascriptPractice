import test from 'node:test';
import assert from 'node:assert/strict';
import { BinarySearchTree, meta } from '../js/structures/bst.js';

function run(iterator) {
  let result = iterator.next();
  while (!result.done) result = iterator.next();
  return result.value;
}

function steps(iterator) {
  return [...iterator];
}

function childOf(state, id, side) {
  return state.edges.find((edge) => edge.from === id && edge.side === side)?.to ?? null;
}

function assertTreeConsistent(bst) {
  const state = bst.getState();
  const byId = new Map(state.nodes.map((node) => [node.id, node]));

  assert.equal(new Set(state.nodes.map((node) => node.id)).size, state.nodes.length, 'node ids must be unique');
  for (const edge of state.edges) {
    assert.ok(byId.has(edge.from), `edge source ${edge.from} must exist`);
    assert.ok(byId.has(edge.to), `edge target ${edge.to} must exist`);
    assert.ok(edge.side === 'left' || edge.side === 'right', 'edge must declare a side');
  }
  assert.equal(state.edges.length, Math.max(0, state.nodes.length - 1), 'a tree has n - 1 edges');

  const incoming = new Map(state.nodes.map((node) => [node.id, 0]));
  for (const edge of state.edges) incoming.set(edge.to, incoming.get(edge.to) + 1);
  if (state.nodes.length === 0) {
    assert.equal(state.root, null);
  } else {
    assert.ok(byId.has(state.root), 'the root must exist');
    assert.equal(incoming.get(state.root), 0, 'the root has no parent');
    for (const node of state.nodes) {
      if (node.id !== state.root) assert.equal(incoming.get(node.id), 1, 'every other node has one parent');
    }
  }

  function checkOrder(id, low, high) {
    if (id === null) return;
    const node = byId.get(id);
    assert.ok(node, 'traversal reached a missing node');
    if (low !== null) assert.ok(node.value > low, `${node.value} must be greater than ${low}`);
    if (high !== null) assert.ok(node.value < high, `${node.value} must be less than ${high}`);
    checkOrder(childOf(state, id, 'left'), low, node.value);
    checkOrder(childOf(state, id, 'right'), node.value, high);
  }
  checkOrder(state.root, null, null);

  const seen = new Set();
  (function walk(id) {
    if (id === null || seen.has(id)) return;
    seen.add(id);
    walk(childOf(state, id, 'left'));
    walk(childOf(state, id, 'right'));
  })(state.root);
  assert.equal(seen.size, state.nodes.length, 'every node must be reachable from the root');
}

function visitedValues(iterator) {
  return steps(iterator)
    .filter((step) => step.type === 'visit' && step.payload && step.payload.value !== undefined)
    .map((step) => step.payload.value);
}

test('initial state and reset produce an empty tree', () => {
  const bst = new BinarySearchTree();
  assert.deepEqual(bst.initialState(), { root: null, nodes: [], edges: [] });
  assert.deepEqual(bst.getState(), { root: null, nodes: [], edges: [] });
  bst.seed([1, 2, 3]);
  bst.reset();
  assert.deepEqual(bst.getState(), { root: null, nodes: [], edges: [] });
});

test('seed builds the demo tree with a valid shape', () => {
  const bst = new BinarySearchTree().reset([50, 30, 70, 20, 40, 60, 80]);
  const state = bst.getState();
  assert.equal(state.root, 'n1');
  assert.deepEqual(state.nodes.map((node) => node.value), [50, 30, 70, 20, 40, 60, 80]);
  assert.equal(childOf(state, 'n1', 'left'), 'n2');
  assert.equal(childOf(state, 'n1', 'right'), 'n3');
  assert.equal(childOf(state, 'n2', 'left'), 'n4');
  assert.equal(childOf(state, 'n2', 'right'), 'n5');
  assertTreeConsistent(bst);
});

test('insert descends with compares and keeps the ordering invariant', () => {
  const bst = new BinarySearchTree().reset([50, 30, 70]);
  const before = steps(bst.insert(25));
  assert.ok(before.some((step) => step.type === 'compare'));
  const insertStep = before.find((step) => step.type === 'insert');
  assert.ok(insertStep);
  assert.ok(insertStep.message.endsWith('.'));
  assert.equal(before.at(-1).type, 'done');
  assertTreeConsistent(bst);
  assert.deepEqual(run(bst.inorder()), [25, 30, 50, 70]);
});

test('insert into an empty tree creates the root with a stable id', () => {
  const bst = new BinarySearchTree().reset();
  const result = run(bst.insert(10));
  assert.equal(result, 'n1');
  assert.equal(bst.getState().root, 'n1');
  assert.equal(bst.getState().edges.length, 0);
  assertTreeConsistent(bst);
});

test('duplicate inserts are ignored', () => {
  const bst = new BinarySearchTree().reset([50, 30, 70, 30]);
  const duplicate = steps(bst.insert(50));
  assert.equal(duplicate.at(-1).type, 'miss');
  assert.equal(run(bst.insert(30)), null);
  assert.equal(bst.getState().nodes.length, 3);
  assert.deepEqual(bst.getState().nodes.map((node) => node.value).sort((a, b) => a - b), [30, 50, 70]);
  assertTreeConsistent(bst);
});

test('search returns the node id and yields compare and found steps', () => {
  const bst = new BinarySearchTree().reset([50, 30, 70, 20, 40, 60, 80]);
  const found = steps(bst.search(40));
  assert.ok(found.some((step) => step.type === 'compare'));
  assert.equal(found.at(-1).type, 'found');
  assert.equal(run(bst.search(40)), 'n5');
});

test('search misses for missing values and on an empty tree', () => {
  const bst = new BinarySearchTree().reset([50, 30, 70]);
  const missed = steps(bst.search(35));
  assert.equal(missed.at(-1).type, 'miss');
  assert.equal(run(bst.search(35)), null);
  const empty = new BinarySearchTree().reset();
  assert.equal(run(empty.search(1)), null);
  assert.deepEqual(steps(empty.search(1)).map((step) => step.type), ['miss']);
});

test('delete removes a leaf and reports the decision', () => {
  const bst = new BinarySearchTree().reset([50, 30, 70, 20, 40]);
  const removed = steps(bst.delete(20));
  assert.ok(removed.some((step) => step.type === 'visit' && step.message.includes('leaf')));
  assert.equal(removed.filter((step) => step.type === 'delete').length, 1);
  assert.equal(run(bst.delete(40)), 40);
  assert.deepEqual(run(bst.inorder()), [30, 50, 70]);
  assertTreeConsistent(bst);
});

test('delete handles a node with a single child', () => {
  const bst = new BinarySearchTree().reset([50, 30, 70, 20, 40, 60]);
  run(bst.delete(20));
  run(bst.delete(30)); // 30 now has only the right child 40.
  assert.deepEqual(run(bst.inorder()), [40, 50, 60, 70]);
  assert.equal(childOf(bst.getState(), 'n1', 'left'), 'n5');
  assertTreeConsistent(bst);

  // A left-only child.
  const leftOnly = new BinarySearchTree().reset([50, 30, 20]);
  run(leftOnly.delete(30));
  assert.equal(childOf(leftOnly.getState(), 'n1', 'left'), 'n3');
  assertTreeConsistent(leftOnly);
});

test('delete uses the in-order successor for two children', () => {
  const bst = new BinarySearchTree().reset([50, 30, 70, 20, 40, 60, 80]);
  const removed = steps(bst.delete(50));
  assert.ok(removed.some((step) => step.message.includes('in-order successor')));
  assert.deepEqual(run(bst.inorder()), [20, 30, 40, 60, 70, 80]);
  assert.equal(bst.getState().root, 'n1');
  assert.equal(bst.getState().nodes.find((node) => node.value === 60).id, 'n1');
  assert.ok(!bst.getState().nodes.some((node) => node.id === 'n6'), 'successor node id is removed');
  assertTreeConsistent(bst);
});

test('delete handles a two-child node whose successor is the immediate right child', () => {
  const bst = new BinarySearchTree().reset([50, 30, 70, 60, 80]);
  run(bst.delete(50));
  assert.deepEqual(run(bst.inorder()), [30, 60, 70, 80]);
  assertTreeConsistent(bst);
});

test('delete removes the root in every child configuration', () => {
  const leafRoot = new BinarySearchTree().reset([50]);
  run(leafRoot.delete(50));
  assert.deepEqual(leafRoot.getState(), { root: null, nodes: [], edges: [] });

  const oneChild = new BinarySearchTree().reset([50, 30]);
  run(oneChild.delete(50));
  assert.equal(oneChild.getState().root, 'n2');
  assertTreeConsistent(oneChild);

  const twoChildren = new BinarySearchTree().reset([50, 30, 70]);
  run(twoChildren.delete(50));
  assert.deepEqual(run(twoChildren.inorder()), [30, 70]);
  assertTreeConsistent(twoChildren);
});

test('delete of a missing value leaves the tree unchanged', () => {
  const bst = new BinarySearchTree().reset([50, 30, 70]);
  const snapshot = structuredClone(bst.getState());
  const result = steps(bst.delete(99));
  assert.equal(result.at(-1).type, 'miss');
  assert.equal(run(bst.delete(99)), null);
  assert.deepEqual(bst.getState(), snapshot);
  assertTreeConsistent(bst);
});

test('traversals visit nodes in the expected order', () => {
  const bst = new BinarySearchTree().reset([50, 30, 70, 20, 40, 60, 80]);
  assert.deepEqual(visitedValues(bst.inorder()), [20, 30, 40, 50, 60, 70, 80]);
  assert.deepEqual(visitedValues(bst.preorder()), [50, 30, 20, 40, 70, 60, 80]);
  assert.deepEqual(visitedValues(bst.postorder()), [20, 40, 30, 60, 80, 70, 50]);
});

test('traversal generators return the value sequence and a trailing done step', () => {
  const bst = new BinarySearchTree().reset([10, 5, 15]);
  assert.deepEqual(run(bst.inorder()), [5, 10, 15]);
  assert.deepEqual(run(bst.preorder()), [10, 5, 15]);
  assert.deepEqual(run(bst.postorder()), [5, 15, 10]);
  for (const operation of [bst.inorder(), bst.preorder(), bst.postorder()]) {
    assert.equal(steps(operation).at(-1).type, 'done');
  }
});

test('traversals on an empty tree yield no visits', () => {
  const bst = new BinarySearchTree().reset();
  for (const operation of [bst.inorder(), bst.preorder(), bst.postorder()]) {
    assert.deepEqual(visitedValues(operation), []);
  }
  assert.deepEqual(run(bst.inorder()), []);
});

test('ids remain stable for surviving nodes and reset renumbers from n1', () => {
  const bst = new BinarySearchTree().reset([50, 30, 70, 20]);
  const before = new Map(bst.getState().nodes.map((node) => [node.value, node.id]));
  run(bst.delete(20));
  assert.equal(bst.getState().nodes.find((node) => node.value === 70).id, before.get(70));
  const next = run(bst.insert(80));
  assert.equal(next, 'n5');

  bst.reset([9]);
  assert.deepEqual(bst.getState().nodes.map((node) => node.id), ['n1']);
  assert.equal(bst.getState().root, 'n1');
});

test('the class exposes static metadata for the app shell', () => {
  assert.equal(BinarySearchTree.meta, meta);
  assert.equal(meta.id, 'bst');
  assert.equal(meta.title, 'Binary Search Tree');
  assert.equal(meta.group, 'Trees');
  assert.equal(meta.layout, 'tree');
  assert.deepEqual(meta.demo, [50, 30, 70, 20, 40, 60, 80]);
});

test('argument operations declare fields in order', () => {
  for (const name of ['insert', 'search', 'delete']) {
    assert.deepEqual(meta.operations[name].fields, [
      { name: 'value', label: 'Value', type: 'number', placeholder: 'e.g. 42' },
    ]);
  }
  for (const name of ['inorder', 'preorder', 'postorder']) {
    assert.equal(meta.operations[name].fields, undefined);
  }
});

test('metadata declares Omega, Theta and Big O for every operation', () => {
  const notation = { best: 'Ω', average: 'Θ', worst: 'O' };
  const expected = {
    insert: ['Ω(1)', 'Θ(log n)', 'O(n)'],
    search: ['Ω(1)', 'Θ(log n)', 'O(n)'],
    delete: ['Ω(1)', 'Θ(log n)', 'O(n)'],
    inorder: ['Ω(n)', 'Θ(n)', 'O(n)'],
    preorder: ['Ω(n)', 'Θ(n)', 'O(n)'],
    postorder: ['Ω(n)', 'Θ(n)', 'O(n)'],
  };
  assert.deepEqual(Object.keys(meta.operations), Object.keys(expected));
  for (const [name, operation] of Object.entries(meta.operations)) {
    assert.equal(typeof operation.description, 'string', name);
    for (const [bound, prefix] of Object.entries(notation)) {
      assert.equal(typeof operation[bound].symbol, 'string', `${name}.${bound}`);
      assert.ok(operation[bound].symbol.startsWith(prefix), `${name}.${bound} must start with ${prefix}`);
      assert.equal(operation[bound].symbol, expected[name][['best', 'average', 'worst'].indexOf(bound)]);
      assert.equal(typeof operation[bound].text, 'string', `${name}.${bound}`);
      assert.ok(operation[bound].text.length > 0, `${name}.${bound} needs descriptive text`);
    }
  }
});

test('every yielded step is well formed', () => {
  const operations = [
    (bst) => bst.insert(20),
    (bst) => bst.search(30),
    (bst) => bst.delete(30),
    (bst) => bst.inorder(),
    (bst) => bst.preorder(),
    (bst) => bst.postorder(),
  ];
  for (const makeOperation of operations) {
    const bst = new BinarySearchTree().reset([50, 30, 70]);
    const before = new Set(bst.getState().nodes.map((node) => node.id));
    const yielded = steps(makeOperation(bst));
    const after = new Set(bst.getState().nodes.map((node) => node.id));
    const ids = new Set([...before, ...after]);
    for (const step of yielded) {
      assert.equal(typeof step.type, 'string');
      assert.ok(step.type.length > 0);
      assert.equal(typeof step.message, 'string');
      assert.ok(step.message.endsWith('.'), step.message);
      assert.ok(Array.isArray(step.focus ?? []));
      for (const id of step.focus ?? []) {
        assert.equal(typeof id, 'string');
        assert.ok(ids.has(id), `focus id ${id} must reference an existing node`);
      }
    }
  }
});
