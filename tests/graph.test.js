import test from 'node:test';
import assert from 'node:assert/strict';
import { Graph, meta } from '../js/structures/graph.js';

function run(iterator) {
  let result = iterator.next();
  while (!result.done) result = iterator.next();
  return result.value;
}

function labelOf(state, id) {
  return state.nodes.find((node) => node.id === id)?.value;
}

function idOf(state, label) {
  return state.nodes.find((node) => node.value === label)?.id;
}

// Build an empty graph through the public API, then fill it with a caller's graph.
function buildCustom(vertices, edges, { directed = false, weighted = true } = {}) {
  const graph = new Graph().reset();
  for (const node of [...graph.getState().nodes]) run(graph.removeVertex(node.value));
  run(directed ? graph.useDirected() : graph.useUndirected());
  run(weighted ? graph.useWeighted() : graph.useUnweighted());
  for (const vertex of vertices) run(graph.addVertex(vertex));
  for (const [from, to, weight] of edges) run(graph.addEdge(from, to, weight));
  return graph;
}

test('seed builds the demo graph with stable ids and canonical state', () => {
  const graph = new Graph();
  assert.deepEqual(graph.getState(), {
    nodes: [],
    edges: [],
    directed: false,
    weighted: true,
    pinned: {},
  });

  graph.reset();
  const state = graph.getState();
  assert.deepEqual(Object.keys(state), ['nodes', 'edges', 'directed', 'weighted', 'pinned']);
  assert.deepEqual(state.nodes.map((node) => node.value), ['A', 'B', 'C', 'D', 'E', 'F']);
  assert.deepEqual(state.nodes.map((node) => node.id), ['v1', 'v2', 'v3', 'v4', 'v5', 'v6']);
  assert.equal(state.edges.length, 8);
  assert.equal(state.directed, false);
  assert.equal(state.weighted, true);
  assert.deepEqual(state.pinned, {});
  for (const edge of state.edges) {
    assert.match(edge.from, /^v\d+$/);
    assert.match(edge.to, /^v\d+$/);
    assert.equal(typeof edge.weight, 'number');
    assert.equal(edge.directed, false);
  }
});

test('demo edges are weighted and match the documented demo metadata', () => {
  const graph = new Graph().reset();
  const state = graph.getState();
  const pairs = state.edges.map((edge) => [
    labelOf(state, edge.from),
    labelOf(state, edge.to),
    edge.weight,
  ]);
  assert.deepEqual(pairs, meta.demo.edges.map((edge) => [edge.from, edge.to, edge.weight]));
  assert.deepEqual(meta.demo.vertices, ['A', 'B', 'C', 'D', 'E', 'F']);
  assert.equal(meta.layout, 'force');
});

test('BFS visits vertices level by level and reports levels in payload', () => {
  const graph = new Graph().reset();
  const steps = [...graph.bfs('A')];
  const visits = steps.filter((step) => step.type === 'visit');

  assert.deepEqual(visits.map((step) => step.payload.vertex), ['A', 'B', 'C', 'D', 'E', 'F']);
  assert.deepEqual(visits.map((step) => step.payload.level), [0, 1, 1, 2, 2, 3]);
  assert.equal(steps.at(-1).type, 'done');
  assert.deepEqual(steps.at(-1).payload.levels, { A: 0, B: 1, C: 1, D: 2, E: 2, F: 3 });
  assert.deepEqual(run(graph.bfs('A')), ['A', 'B', 'C', 'D', 'E', 'F']);
  assert.ok(graph.getState().nodes.every((node) => node.visited === true));
});

test('BFS respects directed edges', () => {
  const graph = buildCustom(
    ['A', 'B', 'C'],
    [['A', 'B', 1], ['B', 'C', 1]],
    { directed: true },
  );
  assert.deepEqual(run(graph.bfs('A')), ['A', 'B', 'C']);
  assert.deepEqual(run(graph.bfs('C')), ['C']);
});

test('DFS visits vertices in depth-first order', () => {
  const graph = new Graph().reset();
  const steps = [...graph.dfs('A')];
  const visits = steps.filter((step) => step.type === 'visit');
  assert.deepEqual(visits.map((step) => step.payload.vertex), ['A', 'B', 'D', 'C', 'E', 'F']);
  assert.equal(steps.at(-1).type, 'done');
  assert.deepEqual(steps.at(-1).payload.order, ['A', 'B', 'D', 'C', 'E', 'F']);
  assert.deepEqual(run(graph.dfs('A')), ['A', 'B', 'D', 'C', 'E', 'F']);
});

test('Dijkstra computes shortest distances on the demo graph and emits relaxations', () => {
  const graph = new Graph().reset();
  const steps = [...graph.dijkstra('A')];
  const expected = { A: 0, B: 4, C: 2, D: 9, E: 11, F: 14 };

  assert.equal(steps.at(-1).type, 'done');
  assert.deepEqual(steps.at(-1).payload.distances, expected);
  assert.ok(steps.some((step) => step.type === 'relax'), 'expected at least one relaxation');
  assert.ok(steps.filter((step) => step.type === 'visit').length === 6);
  assert.deepEqual(run(graph.dijkstra('A')), expected);

  for (const node of graph.getState().nodes) {
    assert.equal(node.dist, expected[node.value]);
  }
});

test('Dijkstra works with directed weights on a custom graph', () => {
  const graph = buildCustom(
    ['S', 'A', 'B', 'C', 'D', 'E'],
    [
      ['S', 'A', 4],
      ['S', 'B', 2],
      ['A', 'B', 1],
      ['A', 'C', 5],
      ['B', 'C', 8],
      ['B', 'D', 10],
      ['C', 'D', 2],
      ['C', 'E', 6],
      ['D', 'E', 3],
    ],
    { directed: true },
  );
  const steps = [...graph.dijkstra('S')];
  const expected = { S: 0, A: 4, B: 2, C: 9, D: 11, E: 14 };
  assert.deepEqual(steps.at(-1).payload.distances, expected);

  const relaxTargets = steps
    .filter((step) => step.type === 'relax')
    .map((step) => step.payload.to);
  assert.ok(relaxTargets.includes('C'), 'C should be improved from 10 to 9 through A');
  assert.ok(relaxTargets.includes('E'), 'E should be improved from 15 to 14 through D');
});

test('unreachable vertices stay unvisited and have no distance', () => {
  const graph = buildCustom(
    ['A', 'B', 'X', 'Y'],
    [['A', 'B', 3], ['X', 'Y', 2]],
    { directed: false },
  );

  assert.deepEqual(run(graph.bfs('A')), ['A', 'B']);
  const afterBfs = graph.getState();
  assert.equal(afterBfs.nodes.find((node) => node.value === 'A').visited, true);
  assert.equal(afterBfs.nodes.find((node) => node.value === 'B').visited, true);
  assert.equal(afterBfs.nodes.find((node) => node.value === 'X').visited, undefined);
  assert.equal(afterBfs.nodes.find((node) => node.value === 'Y').visited, undefined);
  assert.deepEqual(run(graph.dfs('A')), ['A', 'B']);

  const distances = run(graph.dijkstra('A'));
  assert.deepEqual(distances, { A: 0, B: 3, X: null, Y: null });

  const state = graph.getState();
  assert.equal(state.nodes.find((node) => node.value === 'X').dist, undefined);
  assert.equal(state.nodes.find((node) => node.value === 'Y').dist, undefined);
  for (const node of state.nodes) {
    if (node.dist !== undefined) assert.ok(Number.isFinite(node.dist));
  }
});

test('traversal from an unknown start yields a miss without changing the graph', () => {
  const graph = new Graph().reset();
  const before = JSON.stringify(graph.getState());
  for (const operation of [graph.bfs('Z'), graph.dfs('Z'), graph.dijkstra('Z')]) {
    const steps = [...operation];
    assert.equal(steps.length, 1);
    assert.equal(steps[0].type, 'miss');
    assert.deepEqual(steps[0].focus, []);
  }
  assert.equal(JSON.stringify(graph.getState()), before);
});

test('addVertex creates a vertex and rejects duplicates', () => {
  const graph = new Graph().reset();
  const steps = [...graph.addVertex('G')];
  assert.equal(steps[0].type, 'insert');
  assert.equal(steps.at(-1).type, 'done');
  assert.equal(graph.getState().nodes.at(-1).id, 'v7');
  assert.equal(graph.getState().nodes.at(-1).value, 'G');

  const duplicate = [...graph.addVertex('G')];
  assert.equal(duplicate[0].type, 'miss');
  assert.equal(graph.getState().nodes.length, 7);
});

test('addEdge defaults empty and non-finite weights to 1', () => {
  const graph = new Graph().reset();
  run(graph.addVertex('G'));
  assert.equal(run(graph.addEdge('A', 'G', '')).weight, 1);
  assert.equal(run(graph.addEdge('A', 'G', '   ')).weight, 1);
  assert.equal(run(graph.addEdge('A', 'G', 'not-a-number')).weight, 1);
  assert.equal(run(graph.addEdge('A', 'G', undefined)).weight, 1);
  assert.equal(run(graph.addEdge('A', 'G', Number.NaN)).weight, 1);
  assert.equal(run(graph.addEdge('A', 'G', 7)).weight, 7);
  assert.equal(run(graph.addEdge('A', 'G', '2.5')).weight, 2.5);
});

test('addEdge yields a miss when either label is absent', () => {
  const graph = new Graph().reset();
  for (const [from, to, missing] of [['A', 'Z', 'Z'], ['Z', 'A', 'Z']]) {
    const steps = [...graph.addEdge(from, to, 1)];
    assert.equal(steps[0].type, 'miss');
    assert.match(steps[0].message, new RegExp(missing));
  }
  assert.equal(graph.getState().edges.length, 8);
});

test('removeVertex removes the vertex, all incident edges and pinned data', () => {
  const graph = new Graph().reset();
  const c = idOf(graph.getState(), 'C');
  graph.getState().pinned[c] = { x: 10, y: 20 };

  const steps = [...graph.removeVertex('C')];
  assert.ok(steps.some((step) => step.type === 'remove'));
  assert.equal(steps.at(-1).type, 'done');

  const state = graph.getState();
  assert.equal(idOf(state, 'C'), undefined);
  assert.equal(state.nodes.length, 5);
  assert.equal(state.edges.length, 5);
  assert.ok(state.edges.every((edge) => edge.from !== c && edge.to !== c));
  assert.equal(state.pinned[c], undefined);

  // Removing a leaf touches only that vertex and its single edge.
  const leafGraph = new Graph().reset();
  run(leafGraph.removeVertex('F'));
  assert.equal(leafGraph.getState().edges.length, 6);
});

test('removeVertex yields a miss for an unknown label', () => {
  const graph = new Graph().reset();
  const steps = [...graph.removeVertex('Z')];
  assert.equal(steps.length, 1);
  assert.equal(steps[0].type, 'miss');
  assert.equal(graph.getState().nodes.length, 6);
});

test('removeEdge distinguishes directed and undirected modes', () => {
  const directed = new Graph().reset();
  run(directed.useDirected());
  run(directed.addEdge('A', 'D', 1));
  const wrongWay = [...directed.removeEdge('D', 'A')];
  assert.equal(wrongWay[0].type, 'miss');
  assert.ok(directed.getState().edges.some(
    (edge) => labelOf(directed.getState(), edge.from) === 'A'
      && labelOf(directed.getState(), edge.to) === 'D',
  ));
  assert.equal(run(directed.removeEdge('A', 'D')), 1);

  const undirected = new Graph().reset();
  run(undirected.useUndirected());
  run(undirected.addEdge('A', 'D', 1));
  assert.equal(run(undirected.removeEdge('D', 'A')), 1);
  assert.ok(!undirected.getState().edges.some(
    (edge) => labelOf(undirected.getState(), edge.from) === 'A'
      && labelOf(undirected.getState(), edge.to) === 'D',
  ));
});

test('removeEdge yields a miss when no edge connects the vertices', () => {
  const graph = new Graph().reset();
  const steps = [...graph.removeEdge('A', 'F')];
  assert.equal(steps[0].type, 'miss');
  assert.equal(graph.getState().edges.length, 8);
});

test('unweighted mode keeps new edges free of weight labels', () => {
  const graph = buildCustom(['A', 'B'], [['A', 'B', 10]], { weighted: false });
  const edge = graph.getState().edges[0];
  assert.equal('weight' in edge, false);
  assert.equal(graph.getState().weighted, false);
});

test('dijkstra reports negative weights instead of producing wrong distances', () => {
  const graph = buildCustom(['A', 'B'], [['A', 'B', -3]]);
  const steps = [...graph.dijkstra('A')];
  assert.equal(steps[0].type, 'miss');
  assert.match(steps[0].message, /non-negative/);
});

test('mode setters update edge flags while preserving vertices and edges', () => {
  const graph = new Graph().reset();
  const nodesBefore = graph.getState().nodes.map((node) => node.id);
  const edgeIdsBefore = graph.getState().edges.map((edge) => `${edge.from}->${edge.to}`);

  for (const setter of [
    graph.useDirected(),
    graph.useUndirected(),
    graph.useWeighted(),
    graph.useUnweighted(),
    graph.useWeighted(),
    graph.useDirected(),
  ]) {
    const steps = [...setter];
    assert.equal(steps.length, 1);
    assert.equal(steps[0].type, 'info');
    assert.ok(steps[0].message.endsWith('.'));
  }

  const state = graph.getState();
  assert.deepEqual(state.nodes.map((node) => node.id), nodesBefore);
  assert.deepEqual(state.edges.map((edge) => `${edge.from}->${edge.to}`), edgeIdsBefore);
  assert.equal(state.directed, true);
  assert.equal(state.weighted, true);
  assert.ok(state.edges.every((edge) => edge.directed === true));
  assert.ok(state.edges.every((edge) => Number.isFinite(edge.weight)));

  run(graph.useUnweighted());
  assert.equal(graph.getState().weighted, false);
  assert.ok(graph.getState().edges.every((edge) => edge.weight === undefined));
  run(graph.useWeighted());
  assert.ok(graph.getState().edges.every((edge) => edge.weight === 1));
});

test('ids are unique and restart from v1 after reset', () => {
  const graph = new Graph().reset();
  run(graph.addVertex('G'));
  run(graph.addVertex('H'));
  const ids = graph.getState().nodes.map((node) => node.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8']);

  graph.reset(['ignored']);
  assert.deepEqual(graph.getState().nodes.map((node) => node.value), ['A', 'B', 'C', 'D', 'E', 'F']);
  assert.equal(graph.getState().nodes[0].id, 'v1');
});

test('per-step state stays consistent during traversals', () => {
  const graph = new Graph().reset();
  const operations = [graph.bfs('A'), graph.dfs('A'), graph.dijkstra('A')];
  const validIds = () => new Set(graph.getState().nodes.map((node) => node.id));

  for (const operation of operations) {
    for (const step of operation) {
      const ids = validIds();
      assert.ok(step.message.endsWith('.'), step.message);
      for (const id of step.focus ?? []) {
        assert.equal(typeof id, 'string');
        assert.ok(ids.has(id), `focus id ${id} must exist`);
      }
      for (const node of graph.getState().nodes) {
        if (node.dist !== undefined) assert.ok(Number.isFinite(node.dist));
      }
    }
  }
});

test('every yielded step from every operation is well formed', () => {
  const graph = new Graph().reset();
  run(graph.addVertex('G'));
  const operations = [
    graph.addVertex('H'),
    graph.addEdge('A', 'H', 2),
    graph.removeEdge('A', 'H'),
    graph.removeVertex('H'),
    graph.bfs('A'),
    graph.dfs('A'),
    graph.dijkstra('A'),
    graph.useDirected(),
    graph.useUndirected(),
    graph.useWeighted(),
    graph.useUnweighted(),
  ];
  for (const operation of operations) {
    let count = 0;
    for (const step of operation) {
      count += 1;
      assert.equal(typeof step.type, 'string');
      assert.ok(step.type.length > 0);
      assert.equal(typeof step.message, 'string');
      assert.ok(step.message.endsWith('.'), step.message);
      assert.ok(Array.isArray(step.focus ?? []));
      for (const id of step.focus ?? []) assert.equal(typeof id, 'string');
      if (step.payload !== undefined) assert.equal(typeof step.payload, 'object');
    }
    assert.ok(count > 0);
  }
});

test('metadata declares signatures, fields and Omega/Theta/Big O bounds', () => {
  assert.equal(meta.id, 'graph');
  assert.equal(meta.title, 'Graph');
  assert.equal(meta.group, 'Graphs');
  assert.equal(typeof meta.description, 'string');
  assert.equal(Graph.meta, meta);

  const notation = { best: 'Ω', average: 'Θ', worst: 'O' };
  const operations = {
    addVertex: ['label'],
    addEdge: ['from', 'to', 'weight'],
    removeVertex: ['label'],
    removeEdge: ['from', 'to'],
    bfs: ['start'],
    dfs: ['start'],
    dijkstra: ['start'],
    useDirected: [],
    useUndirected: [],
    useWeighted: [],
    useUnweighted: [],
  };
  assert.deepEqual(Object.keys(meta.operations), Object.keys(operations));

  for (const [name, fields] of Object.entries(operations)) {
    const operation = meta.operations[name];
    assert.equal(typeof operation.signature, 'string', name);
    assert.equal(typeof operation.label, 'string', name);
    assert.equal(typeof operation.description, 'string', name);
    assert.deepEqual((operation.fields ?? []).map((field) => field.name), fields, name);
    for (const field of operation.fields ?? []) {
      assert.ok(['number', 'string'].includes(field.type), `${name}.${field.name}`);
      assert.equal(typeof field.label, 'string');
    }
    for (const [bound, prefix] of Object.entries(notation)) {
      assert.equal(typeof operation[bound].symbol, 'string', `${name}.${bound}`);
      assert.ok(operation[bound].symbol.startsWith(prefix), `${name}.${bound} must start with ${prefix}`);
      assert.equal(typeof operation[bound].text, 'string', `${name}.${bound}`);
    }
  }

  const weight = meta.operations.addEdge.fields.find((field) => field.name === 'weight');
  assert.equal(weight.required, false);
  assert.match(meta.operations.dijkstra.worst.text, /O\(V²\)/);
});
