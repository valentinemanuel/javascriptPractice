import test from 'node:test';
import assert from 'node:assert/strict';
import { Queue, meta } from '../js/structures/queue.js';

function run(iterator) {
  let result = iterator.next();
  while (!result.done) result = iterator.next();
  return result.value;
}

test('seed fills the queue in FIFO order', () => {
  const queue = new Queue().reset([1, 2, 3]);
  assert.deepEqual(queue.getState().items.map((item) => item.value), [1, 2, 3]);
  assert.equal(queue.getState().head, 'item1');
  assert.equal(queue.getState().tail, 'item3');
  assert.equal(queue.getState().orientation, 'horizontal');
});

test('seed can be called directly on a fresh queue', () => {
  const queue = new Queue();
  assert.deepEqual(queue.seed([4, 5]).getState().items.map((item) => item.value), [4, 5]);
  assert.equal(queue.getState().head, 'item1');
  assert.equal(queue.getState().tail, 'item2');
});

test('enqueue adds an element to the back and moves the tail', () => {
  const queue = new Queue().reset([1]);
  const steps = [...queue.enqueue(9)];
  assert.equal(steps[0].type, 'enqueue');
  assert.deepEqual(queue.getState().items.map((item) => item.value), [1, 9]);
  assert.equal(queue.getState().head, 'item1');
  assert.equal(queue.getState().tail, 'item2');
  assert.deepEqual(steps[0].focus, ['item2']);
});

test('enqueue on an empty queue sets both head and tail', () => {
  const queue = new Queue().reset();
  run(queue.enqueue(7));
  assert.equal(queue.getState().head, 'item1');
  assert.equal(queue.getState().tail, 'item1');
});

test('dequeue removes the oldest element and advances the head', () => {
  const queue = new Queue().reset([1, 2, 3]);
  assert.equal(run(queue.dequeue()), 1);
  assert.equal(queue.getState().head, 'item2');
  assert.deepEqual(queue.getState().items.map((item) => item.value), [2, 3]);
  assert.equal(run(queue.dequeue()), 2);
  assert.equal(queue.getState().head, 'item3');
  assert.equal(queue.getState().tail, 'item3');
  assert.deepEqual(queue.getState().items.map((item) => item.value), [3]);
});

test('dequeue of the last element leaves the queue empty', () => {
  const queue = new Queue().reset([42]);
  assert.equal(run(queue.dequeue()), 42);
  assert.deepEqual(queue.getState().items, []);
  assert.equal(queue.getState().head, null);
  assert.equal(queue.getState().tail, null);
});

test('interleaved enqueue and dequeue maintain FIFO order', () => {
  const queue = new Queue().reset([1, 2]);
  run(queue.enqueue(3));
  assert.equal(run(queue.dequeue()), 1);
  run(queue.enqueue(4));
  assert.deepEqual(
    [run(queue.dequeue()), run(queue.dequeue()), run(queue.dequeue())],
    [2, 3, 4],
  );
  assert.equal(run(queue.isEmpty()), true);
});

test('dequeue on an empty queue yields a miss and returns null', () => {
  const queue = new Queue().reset();
  const steps = [...queue.dequeue()];
  assert.equal(steps[0].type, 'miss');
  assert.equal(steps.length, 1);
  assert.equal(run(queue.dequeue()), null);
  assert.deepEqual(queue.getState().items, []);
});

test('peek returns the front without mutating the queue', () => {
  const queue = new Queue().reset([4, 5, 6]);
  const before = structuredClone(queue.getState());
  assert.equal(run(queue.peek()), 4);
  assert.deepEqual(queue.getState(), before);
  assert.equal(run(queue.peek()), 4);
});

test('peek on an empty queue yields a miss and returns null', () => {
  const queue = new Queue().reset();
  const steps = [...queue.peek()];
  assert.equal(steps[0].type, 'miss');
  assert.equal(run(queue.peek()), null);
});

test('isEmpty reports the current state', () => {
  assert.equal(run(new Queue().reset().isEmpty()), true);
  assert.equal(run(new Queue().reset([1]).isEmpty()), false);
  const queue = new Queue().reset([1]);
  run(queue.dequeue());
  assert.equal(run(queue.isEmpty()), true);
});

test('ids are unique and reset with the structure', () => {
  const queue = new Queue().reset([1, 2]);
  const ids = queue.getState().items.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  queue.reset([7]);
  assert.equal(queue.getState().items[0].id, 'item1');
  assert.equal(queue.getState().head, 'item1');
  assert.equal(queue.getState().tail, 'item1');
});

test('the class exposes static metadata for the app shell', () => {
  assert.equal(Queue.meta, meta);
  assert.equal(Queue.meta.id, 'queue');
  assert.equal(Queue.meta.title, 'Queue');
  assert.equal(Queue.meta.group, 'Linear');
  assert.equal(Queue.meta.layout, 'linear');
  assert.deepEqual(Queue.meta.demo, [3, 7, 12]);
});

test('enqueue declares its numeric value field', () => {
  assert.deepEqual(meta.operations.enqueue.fields, [
    { name: 'value', label: 'Value', type: 'number' },
  ]);
  for (const name of ['dequeue', 'peek', 'isEmpty']) {
    assert.equal(meta.operations[name].fields, undefined);
  }
});

test('metadata declares Omega, Theta and Big O for every operation', () => {
  const notation = { best: 'Ω', average: 'Θ', worst: 'O' };
  assert.deepEqual(Object.keys(meta.operations), ['enqueue', 'dequeue', 'peek', 'isEmpty']);
  for (const [name, operation] of Object.entries(meta.operations)) {
    assert.equal(typeof operation.signature, 'string', name);
    assert.equal(typeof operation.label, 'string', name);
    assert.equal(typeof operation.description, 'string', name);
    for (const [bound, prefix] of Object.entries(notation)) {
      assert.equal(typeof operation[bound].symbol, 'string', `${name}.${bound}`);
      assert.ok(operation[bound].symbol.startsWith(prefix), `${name}.${bound} must start with ${prefix}`);
      assert.equal(typeof operation[bound].text, 'string', `${name}.${bound}`);
      assert.ok(operation[bound].text.length > 0, `${name}.${bound} needs descriptive text`);
    }
  }
});

test('every yielded step is well formed and focuses existing ids', () => {
  const queue = new Queue().reset([1, 2]);
  const operations = [
    queue.enqueue(3),
    queue.dequeue(),
    queue.peek(),
    queue.isEmpty(),
  ];
  for (const operation of operations) {
    for (const step of operation) {
      assert.equal(typeof step.type, 'string');
      assert.ok(step.type.length > 0);
      assert.equal(typeof step.message, 'string');
      assert.ok(step.message.endsWith('.'), step.message);
      const ids = new Set(queue.getState().items.map((item) => item.id));
      for (const id of step.focus ?? []) {
        assert.equal(typeof id, 'string');
        assert.ok(ids.has(id), `focus id ${id} must exist in the state`);
      }
    }
  }
});

test('miss steps on an empty queue are well formed', () => {
  const queue = new Queue().reset();
  for (const operation of [queue.dequeue(), queue.peek(), queue.isEmpty()]) {
    for (const step of operation) {
      assert.equal(typeof step.type, 'string');
      assert.ok(step.message.endsWith('.'), step.message);
      assert.deepEqual(step.focus, []);
    }
  }
});
