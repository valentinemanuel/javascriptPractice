import test from 'node:test';
import assert from 'node:assert/strict';
import { Stack, meta } from '../js/structures/stack.js';

function run(iterator) {
  let result = iterator.next();
  while (!result.done) result = iterator.next();
  return result.value;
}

test('seed fills the stack in LIFO order', () => {
  const stack = new Stack().reset([1, 2, 3]);
  assert.deepEqual(stack.getState().items.map((item) => item.value), [1, 2, 3]);
  assert.equal(stack.getState().top, 'item3');
});

test('push adds an element to the top', () => {
  const stack = new Stack().reset([1]);
  const steps = [...stack.push(9)];
  assert.equal(steps[0].type, 'push');
  assert.deepEqual(stack.getState().items.map((item) => item.value), [1, 9]);
});

test('pop removes the most recent element', () => {
  const stack = new Stack().reset([1, 2, 3]);
  assert.equal(run(stack.pop()), 3);
  assert.equal(run(stack.pop()), 2);
  assert.deepEqual(stack.getState().items.map((item) => item.value), [1]);
});

test('pop on an empty stack yields a miss', () => {
  const stack = new Stack().reset();
  const steps = [...stack.pop()];
  assert.equal(steps[0].type, 'miss');
  assert.equal(stack.getState().items.length, 0);
});

test('peek does not mutate the stack', () => {
  const stack = new Stack().reset([4, 5]);
  assert.equal(run(stack.peek()), 5);
  assert.equal(stack.getState().items.length, 2);
});

test('isEmpty reports the current state', () => {
  assert.equal(run(new Stack().reset().isEmpty()), true);
  assert.equal(run(new Stack().reset([1]).isEmpty()), false);
});

test('ids are unique and reset with the structure', () => {
  const stack = new Stack().reset([1, 2]);
  const ids = stack.getState().items.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  stack.reset([7]);
  assert.equal(stack.getState().items[0].id, 'item1');
});

test('the class exposes static metadata for the app shell', () => {
  assert.equal(Stack.meta, meta);
  assert.equal(Stack.meta.title, 'Stack');
});

test('peek on an empty stack yields a miss', () => {
  const stack = new Stack().reset();
  const steps = [...stack.peek()];
  assert.equal(steps[0].type, 'miss');
  assert.equal(run(stack.peek()), null);
});

test('push yields a trailing done step with valid focus ids', () => {
  const stack = new Stack().reset();
  const steps = [...stack.push(5)];
  assert.equal(steps.length, 2);
  assert.equal(steps.at(-1).type, 'done');
  const ids = new Set(stack.getState().items.map((item) => item.id));
  assert.ok(ids.has(steps[0].focus[0]));
});

test('every yielded step is well formed', () => {
  const stack = new Stack().reset([1, 2]);
  const operations = [
    stack.push(3),
    stack.pop(),
    stack.peek(),
    stack.isEmpty(),
  ];
  for (const operation of operations) {
    for (const step of operation) {
      assert.equal(typeof step.type, 'string');
      assert.ok(step.type.length > 0);
      assert.equal(typeof step.message, 'string');
      assert.ok(step.message.endsWith('.'), step.message);
      for (const id of step.focus ?? []) {
        assert.equal(typeof id, 'string');
      }
    }
  }
});

test('metadata declares Omega, Theta and Big O for every operation', () => {
  const notation = { best: 'Ω', average: 'Θ', worst: 'O' };
  for (const [name, operation] of Object.entries(meta.operations)) {
    assert.equal(typeof operation.description, 'string', name);
    for (const [bound, prefix] of Object.entries(notation)) {
      assert.equal(typeof operation[bound].symbol, 'string', `${name}.${bound}`);
      assert.ok(operation[bound].symbol.startsWith(prefix), `${name}.${bound} must start with ${prefix}`);
      assert.equal(typeof operation[bound].text, 'string', `${name}.${bound}`);
    }
  }
});
