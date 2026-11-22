import test from 'node:test';
import assert from 'node:assert/strict';
import { registry } from '../js/registry.js';
import {
  applySettings,
  buildSvgStyles,
  createFileName,
  createPayload,
  createStructure,
  parsePayload,
  sceneViewport,
  settingsFor,
} from '../js/utils/io.js';

function run(iterator) {
  let result = iterator.next();
  while (!result.done) result = iterator.next();
  return result.value;
}

test('the export payload follows the StructLab schema', () => {
  const state = new registry.graph.Structure().reset().getState();
  const payload = createPayload('graph', state);

  assert.deepEqual(Object.keys(payload), ['app', 'version', 'structure', 'settings', 'data']);
  assert.equal(payload.app, 'StructLab');
  assert.equal(payload.version, 1);
  assert.equal(payload.structure, 'graph');
  assert.deepEqual(payload.settings, { directed: false, weighted: true });
  assert.equal(payload.data.nodes.length, 6);

  payload.data.nodes[0].value = 'changed';
  assert.equal(state.nodes[0].value, 'A');
});

test('settings describe the active configuration of configurable structures', () => {
  const table = new registry['hash-table'].Structure().reset();
  for (const _step of table.useQuadraticProbing()) { /* apply */ }
  for (const _step of table.useUniversalHashing()) { /* apply */ }
  assert.deepEqual(settingsFor('hash-table', table.getState()), {
    strategy: 'quadratic',
    hash: 'universal',
  });

  const btree = new registry.btree.Structure();
  assert.deepEqual(settingsFor('btree', btree.getState()), { order: 4 });
  assert.deepEqual(settingsFor('stack', new registry.stack.Structure().getState()), {});
});

test('settings are applied through public operations', () => {
  const graph = new registry.graph.Structure().clear();
  applySettings(graph, 'graph', { directed: true, weighted: false });
  assert.equal(graph.getState().directed, true);
  assert.equal(graph.getState().weighted, false);

  const table = new registry['hash-table'].Structure().clear();
  applySettings(table, 'hash-table', { strategy: 'double', hash: 'multiplication' });
  assert.equal(table.getState().strategy, 'double');
  assert.equal(table.getState().hash, 'multiplication');
});

test('the parser rejects invalid, foreign and unknown files with clear errors', () => {
  const ids = Object.keys(registry);
  const valid = JSON.stringify(createPayload('stack', new registry.stack.Structure().reset().getState()));
  assert.equal(parsePayload(valid, ids).ok, true);

  const cases = [
    ['{bad json', /not valid JSON/],
    [JSON.stringify({ app: 'Other', version: 1, structure: 'stack', data: {} }), /not exported by StructLab/],
    [JSON.stringify({ app: 'StructLab', version: 9, structure: 'stack', data: {} }), /Unsupported format version/],
    [JSON.stringify({ app: 'StructLab', version: 1, structure: 'unknown', data: {} }), /unknown structure/],
    [JSON.stringify({ app: 'StructLab', version: 1, structure: 'stack' }), /no structure data/],
    [JSON.stringify({ app: 'StructLab', version: 1, structure: 'stack', data: 'oops' }), /no structure data/],
  ];
  for (const [text, pattern] of cases) {
    const result = parsePayload(text, ids);
    assert.equal(result.ok, false);
    assert.match(result.error, pattern);
  }
});

test('every exported state round-trips into a fresh structure', () => {
  for (const [id, entry] of Object.entries(registry)) {
    const original = new entry.Structure();
    original.reset(original.meta.demo ?? []);
    const payload = createPayload(id, original.getState());

    const restored = createStructure(id, registry, payload.settings);
    applySettings(restored, id, payload.settings);
    assert.equal(restored.restore(payload.data), restored, id);
    assert.deepEqual(restored.getState(), original.getState(), id);
  }
});

test('file names, view boxes and embedded styles are deterministic', () => {
  assert.equal(createFileName('hash-table', 'json'), 'structlab-hash-table.json');
  assert.equal(createFileName('b+ tree', 'png'), 'structlab-b-tree.png');
  assert.deepEqual(sceneViewport({ x: 10, y: 20, width: 100, height: 50 }, 40), {
    x: -30,
    y: -20,
    width: 180,
    height: 130,
  });
  assert.equal(sceneViewport({ x: 0, y: 0, width: 0, height: 0 }).width, 81);

  const styles = buildSvgStyles({ '--accent': '#58a6ff', '--text': '#fff' });
  assert.match(styles, /--accent:#58a6ff/);
  assert.match(styles, /\.node \.node-label/);
  assert.match(styles, /node-grad-default/);
});

test('a structure with an imported state keeps working', () => {
  const table = new registry['hash-table'].Structure().reset([1, 8, 15]);
  const payload = createPayload('hash-table', table.getState());
  const restored = new registry['hash-table'].Structure();
  restored.restore(payload.data);
  for (const _step of restored.put(22)) { /* apply */ }
  assert.equal(restored.getState().size, 4);
});

test('a B-tree keeps a custom order after an import', () => {
  const tree = new registry.btree.Structure(6);
  for (const value of [1, 3, 5, 7, 9, 11]) run(tree.insert(value));
  const payload = createPayload('btree', tree.getState());
  assert.equal(payload.settings.order, 6);

  const restored = createStructure('btree', registry, payload.settings);
  restored.restore(payload.data);
  assert.equal(restored.order, 6);
  run(restored.insert(13));
  assert.ok(restored.getState().nodes.some((node) => node.keys.includes(13)));
});

test('graph indexes survive a restore and still accept new vertices', () => {
  const graph = new registry.graph.Structure().reset();
  const payload = createPayload('graph', graph.getState());
  const restored = new registry.graph.Structure();
  restored.restore(payload.data);

  const before = restored.getState().nodes.length;
  const newId = run(restored.addVertex('Z'));
  run(restored.addEdge('Z', 'A', 3));
  const state = restored.getState();

  assert.equal(state.nodes.length, before + 1);
  assert.equal(state.nodes.at(-1).id, newId);
  assert.ok(state.edges.some((edge) => edge.to === state.nodes[0].id));
  assert.equal(new Set(state.nodes.map((node) => node.id)).size, state.nodes.length);
});

test('B+ tree child cache survives a restore and still accepts inserts', () => {
  const tree = new registry['b-plus-tree'].Structure().reset([1, 3, 5, 7, 9]);
  const payload = createPayload('b-plus-tree', tree.getState());
  const restored = createStructure('b-plus-tree', registry, payload.settings);
  restored.restore(payload.data);

  run(restored.insert(11));
  const state = restored.getState();
  assert.ok(state.nodes.flatMap((node) => node.keys).includes(11));
  assert.equal(new Set(state.nodes.map((node) => node.id)).size, state.nodes.length);
});
