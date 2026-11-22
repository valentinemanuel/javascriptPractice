import test from 'node:test';
import assert from 'node:assert/strict';
import { registry } from '../js/registry.js';

function drain(iterator) {
  for (const _step of iterator) { /* apply without animating */ }
}

test('clear empties every registered structure', () => {
  for (const [id, entry] of Object.entries(registry)) {
    const structure = new entry.Structure();
    structure.reset(structure.meta.demo ?? []);
    assert.equal(typeof structure.clear, 'function', id);
    assert.equal(structure.clear(), structure, id);

    const state = structure.getState();
    if (Array.isArray(state.buckets)) {
      assert.equal(state.size, 0, id);
      assert.ok(state.buckets.every((bucket) => bucket.items.length === 0), id);
    } else if (Array.isArray(state.items)) {
      assert.equal(state.items.length, 0, id);
    } else {
      assert.equal(state.nodes.length, id === 'trie' ? 1 : 0, id);
      assert.equal((state.edges ?? []).length, 0, id);
    }
  }
});

test('clearing an array restores the initial reserved capacity', () => {
  const array = new registry.array.Structure().reset([1, 2, 3, 4, 5]);
  assert.ok(array.getState().capacity > 4);
  array.clear();
  assert.equal(array.getState().capacity, 4);
  assert.equal(array.getState().size, 0);
});

test('clearing a hash table keeps every bucket empty and reusable', () => {
  const table = new registry['hash-table'].Structure().reset();
  for (const value of [1, 8, 15]) drain(table.put(value));
  const capacity = table.getState().capacity;
  table.clear();

  const state = table.getState();
  assert.equal(state.capacity, capacity);
  assert.equal(state.buckets.length, capacity);
  assert.ok(state.buckets.every((bucket) => bucket.items.length === 0));
  drain(table.put(22));
  assert.equal(table.getState().size, 1);
});

test('clearing a trie keeps only the root node', () => {
  const trie = new registry.trie.Structure().reset(['car', 'cat']);
  trie.clear();
  const state = trie.getState();
  assert.equal(state.nodes.length, 1);
  assert.equal(state.nodes[0].id, state.root);
  assert.equal(state.nodes[0].value, '');
});
