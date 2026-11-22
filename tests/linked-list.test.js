import test from 'node:test';
import assert from 'node:assert/strict';
import { LinkedList, meta } from '../js/structures/linked-list.js';

function drain(iterator) {
  const steps = [];
  let result = iterator.next();
  while (!result.done) {
    steps.push(result.value);
    result = iterator.next();
  }
  return { steps, value: result.value };
}

function values(list) {
  return list.getState().nodes.map((node) => node.value);
}

function assertConsistent(list) {
  const state = list.getState();
  const ids = state.nodes.map((node) => node.id);
  assert.equal(new Set(ids).size, ids.length, 'node ids must be unique');
  assert.equal(state.head, state.nodes[0]?.id ?? null, 'head must be the first node');
  assert.equal(state.tail, state.nodes.at(-1)?.id ?? null, 'tail must be the last node');
  state.nodes.forEach((node, index) => {
    assert.equal(node.next, state.nodes[index + 1]?.id ?? null, 'next must point to the following node');
    assert.equal(typeof node.id, 'string');
  });
  assert.deepEqual(
    state.edges,
    state.nodes
      .filter((node) => node.next !== null)
      .map((node) => ({ from: node.id, to: node.next, directed: true })),
    'edges must mirror every next pointer',
  );
  assert.equal(state.orientation, 'horizontal');
  return state;
}

test('a fresh list is empty and seed builds nodes in the supplied order', () => {
  const list = new LinkedList();
  assert.deepEqual(list.getState().nodes, []);
  assert.equal(list.getState().head, null);
  assert.equal(list.getState().tail, null);

  const seeded = list.reset([4, 8, 15]);
  assert.equal(seeded, list);
  assert.deepEqual(values(list), [4, 8, 15]);
  assert.equal(list.getState().head, 'node1');
  assert.equal(list.getState().tail, 'node3');
  assertConsistent(list);
});

test('seed can be called again to append values', () => {
  const list = new LinkedList().reset([1, 2]);
  list.seed([3, 4]);
  assert.deepEqual(values(list), [1, 2, 3, 4]);
  assertConsistent(list);
});

test('insertHead adds to the front and updates the head', () => {
  const list = new LinkedList().reset([8, 15]);
  const { steps, value } = drain(list.insertHead(4));
  assert.equal(value, 'node3');
  assert.deepEqual(values(list), [4, 8, 15]);
  assert.equal(list.getState().head, 'node3');
  assert.equal(list.getState().tail, 'node2');
  assert.deepEqual(steps.map((step) => step.type), ['insert', 'done']);
  assertConsistent(list);
});

test('insertHead on an empty list sets both head and tail', () => {
  const list = new LinkedList().reset();
  drain(list.insertHead(7));
  assert.deepEqual(values(list), [7]);
  assert.equal(list.getState().head, list.getState().tail);
  assertConsistent(list);
});

test('insertTail appends to the end and updates the tail', () => {
  const list = new LinkedList().reset([4, 8]);
  const { steps, value } = drain(list.insertTail(15));
  assert.equal(value, 'node3');
  assert.deepEqual(values(list), [4, 8, 15]);
  assert.equal(list.getState().head, 'node1');
  assert.equal(list.getState().tail, 'node3');
  assert.deepEqual(steps.map((step) => step.type), ['insert', 'done']);
  assertConsistent(list);
});

test('insertTail on an empty list sets both head and tail', () => {
  const list = new LinkedList().reset();
  drain(list.insertTail(9));
  assert.deepEqual(values(list), [9]);
  assert.equal(list.getState().head, list.getState().tail);
  assertConsistent(list);
});

test('insertAt inserts in the middle after walking from the head', () => {
  const list = new LinkedList().reset([4, 8, 15]);
  const { steps } = drain(list.insertAt(2, 12));
  assert.deepEqual(values(list), [4, 8, 12, 15]);
  assert.equal(steps.filter((step) => step.type === 'visit').length, 1);
  assert.deepEqual(steps.at(-2).type, 'insert');
  assert.equal(steps.at(-1).type, 'done');
  assertConsistent(list);
});

test('insertAt at index zero and at the length act like head and tail insertion', () => {
  const list = new LinkedList().reset([8, 15]);
  drain(list.insertAt(0, 4));
  drain(list.insertAt(list.getState().nodes.length, 16));
  assert.deepEqual(values(list), [4, 8, 15, 16]);
  assert.equal(list.getState().head, 'node3');
  assert.equal(list.getState().tail, 'node4');
  assertConsistent(list);
});

test('insertAt on an empty list only accepts index zero', () => {
  const list = new LinkedList().reset();
  drain(list.insertAt(0, 5));
  assert.deepEqual(values(list), [5]);
  assertConsistent(list);

  const other = new LinkedList().reset();
  const { steps, value } = drain(other.insertAt(1, 5));
  assert.equal(value, null);
  assert.equal(steps[0].type, 'miss');
  assert.deepEqual(values(other), []);
  assertConsistent(other);
});

test('insertAt with an out-of-range index yields a miss and changes nothing', () => {
  const list = new LinkedList().reset([4, 8, 15]);
  for (const index of [-1, 4, 99, 1.5, Number.NaN]) {
    const { steps, value } = drain(list.insertAt(index, 100));
    assert.equal(value, null);
    assert.equal(steps[0].type, 'miss');
    assert.ok(steps[0].message.endsWith('.'));
    assert.deepEqual(values(list), [4, 8, 15]);
    assertConsistent(list);
  }
});

test('delete removes the head and updates head and tail correctly', () => {
  const list = new LinkedList().reset([4, 8, 15]);
  const { steps, value } = drain(list.delete(4));
  assert.equal(value, 'node1');
  assert.deepEqual(values(list), [8, 15]);
  assert.equal(list.getState().head, 'node2');
  assert.equal(list.getState().tail, 'node3');
  assert.equal(steps.filter((step) => step.type === 'visit').length, 1);
  assert.equal(steps.find((step) => step.type === 'delete').message, 'Removed the first node with value 4 from the list.');
  assertConsistent(list);
});

test('delete removes a middle node and reconnects its neighbors', () => {
  const list = new LinkedList().reset([4, 8, 15]);
  drain(list.delete(8));
  assert.deepEqual(values(list), [4, 15]);
  assert.equal(list.getState().head, 'node1');
  assert.equal(list.getState().tail, 'node3');
  assert.equal(list.getState().nodes[0].next, 'node3');
  assertConsistent(list);
});

test('delete removes the tail and updates the tail pointer', () => {
  const list = new LinkedList().reset([4, 8, 15]);
  drain(list.delete(15));
  assert.deepEqual(values(list), [4, 8]);
  assert.equal(list.getState().tail, 'node2');
  assert.equal(list.getState().nodes[1].next, null);
  assertConsistent(list);
});

test('delete removes only the first matching value', () => {
  const list = new LinkedList().reset([4, 8, 8, 15]);
  const first = drain(list.delete(8));
  assert.equal(first.value, 'node2');
  assert.deepEqual(values(list), [4, 8, 15]);
  assertConsistent(list);
  drain(list.delete(8));
  assert.deepEqual(values(list), [4, 15]);
  assertConsistent(list);
});

test('delete removes the only node and leaves an empty list', () => {
  const list = new LinkedList().reset([42]);
  drain(list.delete(42));
  assert.deepEqual(values(list), []);
  assert.equal(list.getState().head, null);
  assert.equal(list.getState().tail, null);
  assert.deepEqual(list.getState().edges, []);
  assertConsistent(list);
});

test('delete of a missing value yields a miss and leaves the list unchanged', () => {
  const list = new LinkedList().reset([4, 8, 15]);
  const { steps, value } = drain(list.delete(99));
  assert.equal(value, null);
  assert.equal(steps.filter((step) => step.type === 'visit').length, 3);
  assert.equal(steps.at(-1).type, 'miss');
  assert.deepEqual(values(list), [4, 8, 15]);
  assertConsistent(list);
});

test('delete on an empty list yields a miss', () => {
  const list = new LinkedList().reset();
  const { steps, value } = drain(list.delete(1));
  assert.equal(value, null);
  assert.deepEqual(steps.map((step) => step.type), ['miss']);
  assertConsistent(list);
});

test('search yields one visit per inspected node and returns the found id', () => {
  const list = new LinkedList().reset([4, 8, 15]);
  const { steps, value } = drain(list.search(15));
  assert.equal(value, 'node3');
  assert.deepEqual(steps.map((step) => step.type), ['visit', 'visit', 'visit', 'found']);
  assert.equal(steps.at(-1).message, 'Found value 15 at index 2.');
  assert.deepEqual(steps[2].focus, ['node3']);
  assertConsistent(list);
});

test('search finds the first duplicate and does not mutate the list', () => {
  const list = new LinkedList().reset([4, 8, 8, 15]);
  const { steps, value } = drain(list.search(8));
  assert.equal(value, 'node2');
  assert.equal(steps.filter((step) => step.type === 'visit').length, 2);
  assert.deepEqual(values(list), [4, 8, 8, 15]);
  assertConsistent(list);
});

test('search for a missing value yields a miss after visiting every node', () => {
  const list = new LinkedList().reset([4, 8, 15]);
  const { steps, value } = drain(list.search(99));
  assert.equal(value, null);
  assert.equal(steps.filter((step) => step.type === 'visit').length, 3);
  assert.equal(steps.at(-1).type, 'miss');
  assertConsistent(list);
});

test('search on an empty list yields only a miss', () => {
  const list = new LinkedList().reset();
  const { steps, value } = drain(list.search(1));
  assert.equal(value, null);
  assert.deepEqual(steps.map((step) => step.type), ['miss']);
  assertConsistent(list);
});

test('reverse flips values, pointers, head, tail and edges', () => {
  const list = new LinkedList().reset([4, 8, 15]);
  const { steps, value } = drain(list.reverse());
  assert.equal(value, 'node3');
  assert.deepEqual(values(list), [15, 8, 4]);
  assert.equal(list.getState().head, 'node3');
  assert.equal(list.getState().tail, 'node1');
  assert.equal(steps.filter((step) => step.type === 'visit').length, 3);
  assert.equal(steps.at(-1).type, 'done');
  assertConsistent(list);
});

test('reverse twice restores the original order', () => {
  const list = new LinkedList().reset([1, 2, 3, 4]);
  drain(list.reverse());
  drain(list.reverse());
  assert.deepEqual(values(list), [1, 2, 3, 4]);
  assert.equal(list.getState().head, 'node1');
  assert.equal(list.getState().tail, 'node4');
  assertConsistent(list);
});

test('reverse handles empty and single-node lists', () => {
  const empty = new LinkedList().reset();
  drain(empty.reverse());
  assert.deepEqual(values(empty), []);
  assert.equal(empty.getState().head, null);
  assert.equal(empty.getState().tail, null);
  assertConsistent(empty);

  const single = new LinkedList().reset([7]);
  drain(single.reverse());
  assert.deepEqual(values(single), [7]);
  assert.equal(single.getState().head, single.getState().tail);
  assertConsistent(single);
});

test('canonical state stays consistent across a mixed sequence of operations', () => {
  const list = new LinkedList().reset([4, 8, 15]);
  const operations = [
    list.insertHead(2),
    list.insertTail(16),
    list.insertAt(2, 6),
    list.delete(15),
    list.search(8),
    list.reverse(),
    list.insertAt(1, 99),
    list.delete(2),
    list.insertAt(99, 1),
    list.delete(123),
    list.search(123),
    list.reverse(),
  ];
  for (const operation of operations) {
    drain(operation);
    assertConsistent(list);
  }
  assert.deepEqual(values(list), [4, 6, 8, 99, 16]);
});

test('ids are unique and restart from node1 after a reset', () => {
  const list = new LinkedList().reset([1, 2]);
  assert.deepEqual(list.getState().nodes.map((node) => node.id), ['node1', 'node2']);
  drain(list.insertHead(0));
  const ids = list.getState().nodes.map((node) => node.id);
  assert.equal(new Set(ids).size, ids.length);
  list.reset([7, 9]);
  assert.deepEqual(list.getState().nodes.map((node) => node.id), ['node1', 'node2']);
  assertConsistent(list);
});

test('the class exposes static metadata for the app shell', () => {
  assert.equal(LinkedList.meta, meta);
  assert.equal(LinkedList.meta.title, 'Linked List');
  assert.equal(LinkedList.meta.id, 'linked-list');
  assert.equal(LinkedList.meta.group, 'Linear');
  assert.equal(LinkedList.meta.layout, 'linear');
  assert.deepEqual(LinkedList.meta.demo, [4, 8, 15]);
  assert.equal(typeof LinkedList.meta.description, 'string');
});

test('metadata declares signatures, fields and Omega, Theta and Big O for every operation', () => {
  assert.deepEqual(Object.keys(meta.operations), [
    'insertHead',
    'insertTail',
    'insertAt',
    'delete',
    'search',
    'reverse',
  ]);
  const notation = { best: 'Ω', average: 'Θ', worst: 'O' };
  for (const [name, operation] of Object.entries(meta.operations)) {
    assert.equal(typeof operation.signature, 'string', name);
    assert.equal(typeof operation.label, 'string', name);
    assert.equal(typeof operation.description, 'string', name);
    for (const [bound, prefix] of Object.entries(notation)) {
      assert.equal(typeof operation[bound].symbol, 'string', `${name}.${bound}`);
      assert.ok(operation[bound].symbol.startsWith(prefix), `${name}.${bound} must start with ${prefix}`);
      assert.equal(typeof operation[bound].text, 'string', `${name}.${bound}`);
    }
  }
  assert.deepEqual(meta.operations.insertHead.fields, [{ name: 'value', label: 'Value', type: 'number', placeholder: 'e.g. 42' }]);
  assert.deepEqual(meta.operations.insertAt.fields.map((field) => field.name), ['index', 'value']);
  assert.deepEqual(meta.operations.search.fields.map((field) => field.name), ['value']);
  assert.deepEqual(meta.operations.reverse.fields, undefined);
  assert.equal(meta.operations.insertHead.best.symbol, 'Ω(1)');
  assert.equal(meta.operations.insertAt.worst.symbol, 'O(n)');
  assert.equal(meta.operations.reverse.best.symbol, 'Ω(n)');
});

test('every public operation is a generator yielding well-formed steps', () => {
  const list = new LinkedList().reset([4, 8, 15]);
  const operations = [
    list.insertHead(1),
    list.insertTail(16),
    list.insertAt(2, 6),
    list.insertAt(-1, 6),
    list.delete(8),
    list.delete(99),
    list.search(4),
    list.search(99),
    list.reverse(),
  ];
  for (const operation of operations) {
    assert.equal(typeof operation.next, 'function');
    const beforeIds = list.getState().nodes.map((node) => node.id);
    const { steps } = drain(operation);
    assert.ok(steps.length > 0, 'each operation must yield at least one step');
    const ids = new Set([...beforeIds, ...list.getState().nodes.map((node) => node.id)]);
    for (const step of steps) {
      assert.equal(typeof step.type, 'string');
      assert.ok(step.type.length > 0);
      assert.equal(typeof step.message, 'string');
      assert.ok(step.message.endsWith('.'), step.message);
      assert.ok(Array.isArray(step.focus));
      for (const id of step.focus) {
        assert.equal(typeof id, 'string');
        assert.ok(ids.has(id), `focus id ${id} must reference an existing node`);
      }
    }
    assertConsistent(list);
  }
});
