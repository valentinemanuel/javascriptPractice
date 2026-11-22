import test from 'node:test';
import assert from 'node:assert/strict';
import { ArrayStructure, meta } from '../js/structures/array.js';

function run(iterator) {
  let result = iterator.next();
  while (!result.done) result = iterator.next();
  return result.value;
}

function values(array) {
  return array.getState().items.map((item) => item.value);
}

function ids(array) {
  return array.getState().items.map((item) => item.id);
}

function idValueMap(array) {
  return new Map(array.getState().items.map((item) => [item.id, item.value]));
}

test('seed fills the cells with stable ids and the initial capacity', () => {
  const array = new ArrayStructure().reset([5, 9, 2, 7]);
  const state = array.getState();
  assert.deepEqual(values(array), [5, 9, 2, 7]);
  assert.deepEqual(ids(array), ['cell1', 'cell2', 'cell3', 'cell4']);
  assert.equal(state.capacity, 4);
  assert.equal(state.size, 4);
  assert.equal(state.orientation, 'horizontal');
});

test('seed doubles the capacity once more cells are needed', () => {
  const array = new ArrayStructure().reset([1, 2, 3, 4, 5]);
  assert.equal(array.getState().capacity, 8);
  assert.equal(array.getState().size, 5);

  const larger = new ArrayStructure().reset(Array.from({ length: 9 }, (_, i) => i));
  assert.equal(larger.getState().capacity, 16);
  assert.equal(larger.getState().size, 9);
  assert.equal(new Set(ids(larger)).size, 9);
});

test('reset restores the empty state, capacity and ids', () => {
  const array = new ArrayStructure().reset([1, 2, 3, 4, 5]);
  assert.equal(array.getState().capacity, 8);
  array.reset([7]);
  assert.deepEqual(values(array), [7]);
  assert.deepEqual(ids(array), ['cell1']);
  assert.equal(array.getState().capacity, 4);
  assert.equal(array.getState().size, 1);
});

test('access returns the value at a valid index', () => {
  const array = new ArrayStructure().reset([5, 9, 2, 7]);
  const steps = [...array.access(2)];
  assert.equal(run(array.access(2)), 2);
  assert.equal(steps.at(-1).type, 'access');
  assert.deepEqual(steps.at(-1).focus, ['cell3']);
});

test('access yields a miss for out-of-range and non-integer indices', () => {
  const array = new ArrayStructure().reset([5, 9]);
  for (const index of [-1, 2, 99, 1.5]) {
    const steps = [...array.access(index)];
    assert.equal(steps[0].type, 'miss', `index ${index}`);
    assert.equal(run(array.access(index)), null);
    assert.deepEqual(steps[0].focus, []);
  }
  const empty = new ArrayStructure().reset();
  assert.equal([...empty.access(0)][0].type, 'miss');
});

test('insert at the end appends without shifting', () => {
  const array = new ArrayStructure().reset([1, 2]);
  const steps = [...array.insert(2, 3)];
  assert.deepEqual(values(array), [1, 2, 3]);
  assert.deepEqual(ids(array), ['cell1', 'cell2', 'cell3']);
  assert.equal(steps.some((step) => step.type === 'shift'), false);
  assert.equal(steps.at(-1).type, 'insert');
  assert.deepEqual(steps.at(-1).focus, ['cell3']);
  assert.equal(run(array.insert(3, 4)), 4);
});

test('insert at the beginning shifts every element and keeps ids attached', () => {
  const array = new ArrayStructure().reset([1, 2, 3]);
  const before = idValueMap(array);
  const steps = [...array.insert(0, 0)];
  assert.deepEqual(values(array), [0, 1, 2, 3]);
  assert.deepEqual(ids(array), ['cell4', 'cell1', 'cell2', 'cell3']);
  assert.equal(steps.filter((step) => step.type === 'shift').length, 3);
  for (const item of array.getState().items) {
    if (before.has(item.id)) assert.equal(item.value, before.get(item.id), item.id);
  }
});

test('insert in the middle shifts only the tail', () => {
  const array = new ArrayStructure().reset([1, 2, 3, 4]);
  const before = idValueMap(array);
  const steps = [...array.insert(2, 99)];
  assert.deepEqual(values(array), [1, 2, 99, 3, 4]);
  assert.deepEqual(ids(array), ['cell1', 'cell2', 'cell5', 'cell3', 'cell4']);
  assert.equal(steps.filter((step) => step.type === 'shift').length, 2);
  for (const item of array.getState().items) {
    if (before.has(item.id)) assert.equal(item.value, before.get(item.id), item.id);
  }
});

test('insert into an empty array works and does not grow the capacity', () => {
  const array = new ArrayStructure().reset();
  const steps = [...array.insert(0, 6)];
  assert.deepEqual(values(array), [6]);
  assert.equal(array.getState().capacity, 4);
  assert.equal(array.getState().size, 1);
  assert.equal(steps.some((step) => step.type === 'visit'), false);
});

test('insert into a full array yields a capacity-growth step', () => {
  const array = new ArrayStructure().reset([1, 2, 3, 4]);
  const steps = [...array.insert(4, 5)];
  assert.equal(array.getState().capacity, 8);
  assert.deepEqual(values(array), [1, 2, 3, 4, 5]);
  const growth = steps.find((step) => step.type === 'visit');
  assert.ok(growth);
  assert.match(growth.message, /capacity doubles to 8/);
  assert.deepEqual(growth.focus, ['cell1', 'cell2', 'cell3', 'cell4']);
});

test('insert yields a miss for out-of-range indices without mutating', () => {
  const array = new ArrayStructure().reset([1, 2]);
  for (const index of [-1, 3, 1.5]) {
    const steps = [...array.insert(index, 99)];
    assert.equal(steps[0].type, 'miss', `index ${index}`);
    assert.deepEqual(values(array), [1, 2]);
    assert.equal(array.getState().size, 2);
  }
});

test('delete shifts later elements left and keeps ids attached', () => {
  const array = new ArrayStructure().reset([5, 9, 2, 7]);
  const before = idValueMap(array);
  const steps = [...array.delete(1)];
  assert.deepEqual(values(array), [5, 2, 7]);
  assert.deepEqual(ids(array), ['cell1', 'cell3', 'cell4']);
  assert.equal(steps.filter((step) => step.type === 'shift').length, 2);
  for (const item of array.getState().items) {
    assert.equal(item.value, before.get(item.id), item.id);
  }
  assert.equal(steps.at(-1).type, 'delete');
  assert.deepEqual(steps.at(-1).focus, ['cell3']);
});

test('deleting a leaf needs no shift, and the last element can be removed', () => {
  const array = new ArrayStructure().reset([1, 2, 3]);
  assert.equal(run(array.delete(2)), 3);
  assert.deepEqual(values(array), [1, 2]);
  assert.equal(run(array.delete(1)), 2);
  assert.deepEqual(values(array), [1]);
  assert.equal(run(array.delete(0)), 1);
  assert.deepEqual(values(array), []);
  assert.equal(array.getState().size, 0);
  assert.equal(array.getState().capacity, 4);
});

test('delete yields a miss for out-of-range indices without mutating', () => {
  const array = new ArrayStructure().reset([1, 2]);
  for (const index of [-1, 2, 1.5]) {
    const steps = [...array.delete(index)];
    assert.equal(steps[0].type, 'miss', `index ${index}`);
    assert.deepEqual(values(array), [1, 2]);
  }
  const empty = new ArrayStructure().reset();
  assert.equal([...empty.delete(0)][0].type, 'miss');
});

test('search returns the first matching index with comparison steps', () => {
  const array = new ArrayStructure().reset([5, 9, 2, 7]);
  const steps = [...array.search(9)];
  assert.equal(steps.filter((step) => step.type === 'compare').length, 2);
  assert.equal(steps.at(-1).type, 'found');
  assert.deepEqual(steps.at(-1).focus, ['cell2']);
  assert.equal(run(array.search(9)), 1);
  assert.equal(run(array.search(5)), 0);
});

test('search reports a miss when the value is absent or the array is empty', () => {
  const array = new ArrayStructure().reset([5, 9, 2, 7]);
  const steps = [...array.search(42)];
  assert.equal(steps.filter((step) => step.type === 'compare').length, 4);
  assert.equal(steps.at(-1).type, 'miss');
  assert.equal(run(array.search(42)), -1);

  const empty = new ArrayStructure().reset();
  const emptySteps = [...empty.search(1)];
  assert.equal(emptySteps.length, 1);
  assert.equal(emptySteps[0].type, 'miss');
});

test('the class exposes static metadata for the app shell', () => {
  assert.equal(ArrayStructure.meta, meta);
  assert.equal(ArrayStructure.meta.id, 'array');
  assert.equal(ArrayStructure.meta.title, 'Array');
  assert.equal(ArrayStructure.meta.group, 'Linear');
  assert.equal(ArrayStructure.meta.layout, 'linear');
  assert.deepEqual(ArrayStructure.meta.demo, [5, 9, 2, 7]);
  assert.deepEqual(new ArrayStructure().getState(), {
    items: [],
    capacity: 4,
    size: 0,
    orientation: 'horizontal',
  });
});

test('metadata declares Omega, Theta and Big O for every operation', () => {
  const notation = { best: 'Ω', average: 'Θ', worst: 'O' };
  for (const [name, operation] of Object.entries(meta.operations)) {
    assert.equal(typeof operation.description, 'string', name);
    assert.equal(typeof operation.signature, 'string', name);
    assert.equal(typeof operation.label, 'string', name);
    for (const [bound, prefix] of Object.entries(notation)) {
      assert.equal(typeof operation[bound].symbol, 'string', `${name}.${bound}`);
      assert.ok(operation[bound].symbol.startsWith(prefix), `${name}.${bound} must start with ${prefix}`);
      assert.equal(typeof operation[bound].text, 'string', `${name}.${bound}`);
    }
  }
  assert.match(meta.operations.insert.worst.text, /amortized O\(1\)/);
});

test('metadata declares the argument fields in operation order', () => {
  assert.deepEqual(meta.operations.access.fields, [
    { name: 'index', label: 'Index', type: 'number', placeholder: 'e.g. 0' },
  ]);
  assert.deepEqual(meta.operations.insert.fields, [
    { name: 'index', label: 'Index', type: 'number', placeholder: 'e.g. 2' },
    { name: 'value', label: 'Value', type: 'number', placeholder: 'e.g. 42' },
  ]);
  assert.deepEqual(meta.operations.delete.fields, [
    { name: 'index', label: 'Index', type: 'number', placeholder: 'e.g. 1' },
  ]);
  assert.deepEqual(meta.operations.search.fields, [
    { name: 'value', label: 'Value', type: 'number', placeholder: 'e.g. 7' },
  ]);
});

test('every yielded step is well formed', () => {
  const array = new ArrayStructure().reset([5, 9, 2, 7]);
  const operations = [
    array.access(1),
    array.access(9),
    array.insert(2, 6),
    array.insert(9, 6),
    array.delete(0),
    array.delete(9),
    array.search(6),
    array.search(99),
  ];
  for (const operation of operations) {
    for (const step of operation) {
      assert.equal(typeof step.type, 'string');
      assert.ok(step.type.length > 0);
      assert.equal(typeof step.message, 'string');
      assert.ok(step.message.endsWith('.'), step.message);
      assert.ok(Array.isArray(step.focus));
      for (const id of step.focus) assert.equal(typeof id, 'string');
    }
  }
});

test('ids stay unique in every intermediate animation state', () => {
  const array = new ArrayStructure().reset([5, 9, 2, 7]);
  for (const operation of [array.insert(1, 6), array.delete(2)]) {
    for (const _step of operation) {
      const currentIds = array.getState().items.map((item) => item.id);
      assert.equal(new Set(currentIds).size, currentIds.length);
    }
  }
});

test('state size always matches the number of cells after mixed operations', () => {
  const array = new ArrayStructure().reset([1, 2, 3]);
  run(array.insert(0, 0));
  run(array.insert(4, 4));
  run(array.delete(1));
  run(array.delete(3));
  assert.deepEqual(values(array), [0, 2, 3]);
  assert.equal(array.getState().size, array.getState().items.length);
  assert.equal(new Set(ids(array)).size, ids(array).length);
});
