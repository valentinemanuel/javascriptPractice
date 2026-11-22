import test from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../js/core/layout/force.js';

const state = () => ({
  nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
  edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }],
});

test('pinned vertices stay at their dragged coordinates', () => {
  const graph = state();
  graph.pinned = { b: { x: 123, y: 77 } };
  const positions = compute(graph, { width: 900, height: 560 });

  assert.equal(positions.get('b').x, 123);
  assert.equal(positions.get('b').y, 77);
  assert.ok(positions.get('a'));
  assert.ok(positions.get('c'));
});

test('a pinned Map is supported and positions remain deterministic', () => {
  const graph = state();
  graph.pinned = new Map([['c', { x: 200, y: 150 }]]);
  const first = compute(graph, { width: 900, height: 560 });
  const second = compute(graph, { width: 900, height: 560 });

  assert.equal(first.get('c').x, 200);
  assert.equal(first.get('c').y, 150);
  assert.deepEqual([...second], [...first]);
});
