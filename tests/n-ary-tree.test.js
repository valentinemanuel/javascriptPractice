import test from 'node:test';
import assert from 'node:assert/strict';
import { NaryTree, meta } from '../js/structures/n-ary-tree.js';

function run(iterator) {
  let result = iterator.next();
  while (!result.done) result = iterator.next();
  return result.value;
}

function assertConsistent(tree) {
  const state = tree.getState();
  const ids = new Set(state.nodes.map((node) => node.id));
  assert.equal(ids.size, state.nodes.length, 'node ids must be unique');

  if (state.nodes.length === 0) {
    assert.equal(state.root, null, 'an empty tree has no root');
  } else {
    assert.ok(ids.has(state.root), 'the root must refer to an existing node');
  }

  const incoming = new Map([...ids].map((id) => [id, 0]));
  for (const edge of state.edges) {
    assert.ok(ids.has(edge.from), `edge source ${edge.from} must exist`);
    assert.ok(ids.has(edge.to), `edge target ${edge.to} must exist`);
    incoming.set(edge.to, incoming.get(edge.to) + 1);
  }
  for (const id of ids) {
    if (id === state.root) {
      assert.equal(incoming.get(id), 0, 'the root must have no parent');
    } else {
      assert.equal(incoming.get(id), 1, `node ${id} must have exactly one parent`);
    }
  }
}

function allSteps(tree) {
  const steps = [];
  const operations = [
    tree.insert(99),
    tree.insertChild(2, 98),
    tree.search(2),
    tree.delete(3),
    tree.bfs(),
    tree.dfs(),
  ];
  for (const operation of operations) steps.push(...operation);
  return steps;
}

test('seed builds a root with the remaining values as its children', () => {
  const tree = new NaryTree().seed([1, 2, 3, 4]);
  const state = tree.getState();
  assert.equal(state.root, 'n1');
  assert.deepEqual(state.nodes.map((node) => node.value), [1, 2, 3, 4]);
  assert.deepEqual(state.nodes.map((node) => node.id), ['n1', 'n2', 'n3', 'n4']);
  assert.deepEqual(state.edges, [
    { from: 'n1', to: 'n2' },
    { from: 'n1', to: 'n3' },
    { from: 'n1', to: 'n4' },
  ]);
  assertConsistent(tree);
});

test('seed with no values produces an empty tree', () => {
  const tree = new NaryTree().seed([]);
  assert.deepEqual(tree.getState(), { root: null, nodes: [], edges: [] });
  assert.deepEqual(run(tree.bfs()), []);
  assert.deepEqual(run(tree.dfs()), []);
  assertConsistent(tree);
});

test('insert sets the root on an empty tree and appends a child otherwise', () => {
  const tree = new NaryTree().reset();
  const steps = [...tree.insert(10)];
  assert.equal(steps[0].type, 'insert');
  assert.equal(tree.getState().root, 'n1');
  assert.deepEqual(tree.getState().nodes.map((node) => node.value), [10]);

  const id = run(tree.insert(20));
  assert.equal(id, 'n2');
  assert.deepEqual(tree.getState().edges, [{ from: 'n1', to: 'n2' }]);
  assert.equal(tree.getState().root, 'n1');
  assertConsistent(tree);
});

test('insertChild attaches under an intermediate node', () => {
  const tree = new NaryTree().seed([1, 2, 3]);
  const steps = [...tree.insertChild(2, 8)];
  assert.equal(steps[0].type, 'visit');
  assert.ok(steps.some((step) => step.type === 'insert'));
  assert.deepEqual(tree.getState().edges, [
    { from: 'n1', to: 'n2' },
    { from: 'n1', to: 'n3' },
    { from: 'n2', to: 'n4' },
  ]);
  assert.deepEqual(tree.getState().nodes.map((node) => node.value), [1, 2, 3, 8]);
  assertConsistent(tree);
});

test('insertChild misses when the parent value is absent', () => {
  const tree = new NaryTree().seed([1, 2]);
  const steps = [...tree.insertChild(42, 8)];
  assert.equal(steps.at(-1).type, 'miss');
  assert.equal(run(tree.insertChild(42, 8)), null);
  assert.equal(tree.getState().nodes.length, 2);
  assert.equal(tree.getState().edges.length, 1);
  assertConsistent(tree);
});

test('search finds an existing value and misses an absent one', () => {
  const tree = new NaryTree().seed([1, 2, 3]);
  const foundSteps = [...tree.search(3)];
  assert.ok(foundSteps.some((step) => step.type === 'visit'));
  assert.equal(foundSteps.at(-1).type, 'found');
  assert.equal(run(tree.search(3)), 'n3');

  const missSteps = [...tree.search(99)];
  assert.equal(missSteps.at(-1).type, 'miss');
  assert.equal(run(tree.search(99)), null);
  assertConsistent(tree);
});

test('search returns the first matching node when values are duplicated', () => {
  const tree = new NaryTree().seed([1, 2, 2, 3]);
  assert.equal(run(tree.search(2)), 'n2');
  assertConsistent(tree);
});

test('delete removes a leaf without disturbing the rest of the tree', () => {
  const tree = new NaryTree().seed([1, 2, 3]);
  const steps = [...tree.delete(3)];
  assert.ok(steps.some((step) => step.type === 'remove'));
  assert.equal(steps.at(-1).type, 'done');
  assert.deepEqual(tree.getState().nodes.map((node) => node.value), [1, 2]);
  assert.deepEqual(tree.getState().edges, [{ from: 'n1', to: 'n2' }]);
  assert.equal(tree.getState().root, 'n1');
  assertConsistent(tree);
});

test('delete removes the whole subtree of an intermediate node', () => {
  const tree = new NaryTree().seed([1, 2, 3]);
  run(tree.insertChild(2, 4));
  run(tree.insertChild(2, 5));
  run(tree.insertChild(4, 6));

  const steps = [...tree.delete(2)];
  const removes = steps.filter((step) => step.type === 'remove');
  assert.equal(removes.length, 4, 'one remove step is emitted per deleted node');
  assert.deepEqual(tree.getState().nodes.map((node) => node.value), [1, 3]);
  assert.deepEqual(tree.getState().edges, [{ from: 'n1', to: 'n3' }]);
  assert.equal(tree.getState().root, 'n1');
  assertConsistent(tree);
});

test('deleting the root clears the entire tree', () => {
  const tree = new NaryTree().seed([1, 2, 3]);
  const steps = [...tree.delete(1)];
  assert.equal(steps.filter((step) => step.type === 'remove').length, 3);
  assert.equal(steps.at(-1).message, 'The tree is now empty.');
  assert.deepEqual(tree.getState(), { root: null, nodes: [], edges: [] });
  assertConsistent(tree);
});

test('delete misses without mutating the tree when the value is absent', () => {
  const tree = new NaryTree().seed([1, 2, 3]);
  const steps = [...tree.delete(77)];
  assert.equal(steps.at(-1).type, 'miss');
  assert.equal(run(tree.delete(77)), null);
  assert.equal(tree.getState().nodes.length, 3);
  assert.equal(tree.getState().edges.length, 2);
  assertConsistent(tree);
});

test('delete removes only the first matching value when duplicates exist', () => {
  const tree = new NaryTree().seed([1, 2, 2, 3]);
  run(tree.delete(2));
  assert.deepEqual(tree.getState().nodes.map((node) => node.value), [1, 2, 3]);
  assert.deepEqual(tree.getState().edges, [{ from: 'n1', to: 'n3' }, { from: 'n1', to: 'n4' }]);
  assertConsistent(tree);
});

test('bfs and dfs visit nodes in their respective orders', () => {
  const tree = new NaryTree().seed([1, 2, 3]);
  run(tree.insertChild(2, 4));
  run(tree.insertChild(2, 5));
  run(tree.insertChild(4, 6));

  const bfsSteps = [...tree.bfs()];
  assert.equal(bfsSteps.filter((step) => step.type === 'visit').length, 6);
  assert.deepEqual(run(tree.bfs()), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(run(tree.dfs()), [1, 2, 4, 6, 5, 3]);
  assertConsistent(tree);
});

test('traversals on an empty tree yield a done step and no visits', () => {
  const tree = new NaryTree().reset();
  const bfsSteps = [...tree.bfs()];
  const dfsSteps = [...tree.dfs()];
  assert.deepEqual(bfsSteps.map((step) => step.type), ['done']);
  assert.deepEqual(dfsSteps.map((step) => step.type), ['done']);
  assert.deepEqual(run(tree.bfs()), []);
  assert.deepEqual(run(tree.dfs()), []);
});

test('ids are stable and reset with the structure', () => {
  const tree = new NaryTree().reset([1, 2]);
  assertConsistent(tree);
  tree.reset([7]);
  assert.deepEqual(tree.getState().nodes.map((node) => node.id), ['n1']);
  assert.equal(tree.getState().root, 'n1');
  assert.deepEqual(tree.getState().edges, []);
  assertConsistent(tree);
});

test('the class exposes static metadata for the app shell', () => {
  assert.equal(NaryTree.meta, meta);
  assert.equal(NaryTree.meta.id, 'n-ary-tree');
  assert.equal(NaryTree.meta.title, 'N-ary Tree');
  assert.equal(NaryTree.meta.group, 'Trees');
  assert.equal(NaryTree.meta.layout, 'tree');
  assert.deepEqual(NaryTree.meta.demo, [1, 2, 3, 4, 5, 6, 7]);
});

test('metadata declares Omega, Theta and Big O for every operation', () => {
  const notation = { best: 'Ω', average: 'Θ', worst: 'O' };
  assert.deepEqual(Object.keys(meta.operations), [
    'insert', 'insertChild', 'search', 'delete', 'bfs', 'dfs',
  ]);
  for (const [name, operation] of Object.entries(meta.operations)) {
    assert.equal(typeof operation.description, 'string', name);
    assert.ok(operation.description.length > 0, name);
    assert.equal(typeof operation.signature, 'string', name);
    for (const [bound, prefix] of Object.entries(notation)) {
      assert.equal(typeof operation[bound].symbol, 'string', `${name}.${bound}`);
      assert.ok(operation[bound].symbol.startsWith(prefix), `${name}.${bound} must start with ${prefix}`);
      assert.equal(typeof operation[bound].text, 'string', `${name}.${bound}`);
      assert.ok(operation[bound].text.length > 0, `${name}.${bound}`);
    }
  }
});

test('metadata declares the input fields in order', () => {
  const expected = {
    insert: ['value'],
    insertChild: ['parentValue', 'value'],
    search: ['value'],
    delete: ['value'],
  };
  for (const [name, names] of Object.entries(expected)) {
    const fields = meta.operations[name].fields;
    assert.deepEqual(fields.map((field) => field.name), names, name);
    for (const field of fields) {
      assert.equal(typeof field.label, 'string', `${name}.${field.name}`);
      assert.ok(['number', 'string'].includes(field.type), `${name}.${field.name}`);
    }
  }
  assert.equal(meta.operations.bfs.fields, undefined);
  assert.equal(meta.operations.dfs.fields, undefined);
});

test('every yielded step is well formed', () => {
  const tree = new NaryTree().seed([1, 2, 3]);
  for (const step of allSteps(tree)) {
    assert.equal(typeof step.type, 'string');
    assert.ok(step.type.length > 0);
    assert.equal(typeof step.message, 'string');
    assert.ok(step.message.endsWith('.'), step.message);
    assert.ok(step.focus === undefined || Array.isArray(step.focus));
    for (const id of step.focus ?? []) {
      assert.equal(typeof id, 'string');
      assert.ok(id.startsWith('n'));
    }
  }
});

test('state stays consistent after a mixed sequence of operations', () => {
  const tree = new NaryTree().seed([1, 2, 3, 4, 5]);
  assertConsistent(tree);
  run(tree.insertChild(1, 6));
  assertConsistent(tree);
  run(tree.insertChild(4, 7));
  assertConsistent(tree);
  run(tree.insert(8));
  assertConsistent(tree);
  run(tree.delete(4));
  assertConsistent(tree);
  run(tree.delete(1));
  assertConsistent(tree);
  run(tree.insert(9));
  assertConsistent(tree);
  run(tree.delete(9));
  assertConsistent(tree);
});
