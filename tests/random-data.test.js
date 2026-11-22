import test from 'node:test';
import assert from 'node:assert/strict';
import { randomValuesFor, applyRandomData } from '../js/ui/random-data.js';
import { Stack } from '../js/structures/stack.js';
import { Graph } from '../js/structures/graph.js';
import { registry } from '../js/registry.js';

test('numeric structures receive a fresh set of numeric keys', () => {
  for (const id of ['stack', 'bst', 'hash-table']) {
    const values = randomValuesFor(id);
    assert.ok(values.length >= 6 && values.length <= 9);
    assert.ok(values.every((value) => Number.isInteger(value)));
  }
});

test('trie receives words instead of numbers', () => {
  const words = randomValuesFor('trie');
  assert.ok(words.length >= 4 && words.length <= 6);
  assert.ok(words.every((word) => typeof word === 'string' && word.length > 0));
});

test('applyRandomData reseeds linear structures', () => {
  const stack = new Stack().reset([1, 2]);
  applyRandomData(stack, 'stack');
  assert.ok(stack.getState().items.length >= 6);
  assert.notDeepEqual(stack.getState().items.map((item) => item.value), [1, 2]);
});

test('applyRandomData reseeds every registered structure', () => {
  for (const [id, entry] of Object.entries(registry)) {
    const structure = new entry.Structure();
    structure.reset(structure.meta.demo ?? []);
    const before = JSON.stringify(structure.getState());

    let changed = false;
    for (let attempt = 0; attempt < 3 && !changed; attempt += 1) {
      applyRandomData(structure, id);
      changed = JSON.stringify(structure.getState()) !== before;
    }
    assert.ok(changed, `${id} should receive a new dataset`);
  }
});

test('applyRandomData builds a connected random graph', () => {
  const graph = new Graph().reset();
  applyRandomData(graph, 'graph');
  const state = graph.getState();
  assert.ok(state.nodes.length >= 5 && state.nodes.length <= 7);
  assert.ok(state.edges.length >= state.nodes.length - 1);
  const ids = new Set(state.nodes.map((node) => node.id));
  assert.ok(state.edges.every((edge) => ids.has(edge.from) && ids.has(edge.to)));
});
