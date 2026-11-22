import { BaseStructure } from '../core/BaseStructure.js';

const DEMO_VERTICES = ['A', 'B', 'C', 'D', 'E', 'F'];
const DEMO_EDGES = [
  ['A', 'B', 4],
  ['A', 'C', 2],
  ['B', 'D', 5],
  ['C', 'D', 8],
  ['C', 'E', 10],
  ['D', 'E', 2],
  ['D', 'F', 6],
  ['E', 'F', 3],
];

function createInitialState() {
  return { nodes: [], edges: [], directed: false, weighted: true, pinned: {} };
}

/**
 * Small binary min-heap with lazy deletion. Entries are ordered by distance
 * and then by id so that equal keys are settled in a deterministic order.
 */
class MinHeap {
  constructor() {
    this.data = [];
  }

  get size() {
    return this.data.length;
  }

  static before(a, b) {
    if (a.dist !== b.dist) return a.dist < b.dist;
    return a.id < b.id;
  }

  push(dist, id) {
    const data = this.data;
    data.push({ dist, id });
    let index = data.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!MinHeap.before(data[index], data[parent])) break;
      [data[index], data[parent]] = [data[parent], data[index]];
      index = parent;
    }
  }

  pop() {
    const data = this.data;
    if (data.length === 0) return null;
    const top = data[0];
    const last = data.pop();
    if (data.length > 0) {
      data[0] = last;
      let index = 0;
      for (;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < data.length && MinHeap.before(data[left], data[smallest])) smallest = left;
        if (right < data.length && MinHeap.before(data[right], data[smallest])) smallest = right;
        if (smallest === index) break;
        [data[index], data[smallest]] = [data[smallest], data[index]];
        index = smallest;
      }
    }
    return top;
  }
}

export const meta = {
  id: 'graph',
  title: 'Graph',
  group: 'Graphs',
  layout: 'force',
  description:
    'A graph is a set of vertices connected by edges. Edges may be directed or undirected and may carry weights, which makes graphs a natural model for networks, maps and dependency relations.',
  demo: {
    vertices: DEMO_VERTICES,
    edges: DEMO_EDGES.map(([from, to, weight]) => ({ from, to, weight })),
  },
  operations: {
    addVertex: {
      signature: 'addVertex(label)',
      label: 'Add vertex',
      fields: [{ name: 'label', label: 'Label', type: 'string', placeholder: 'e.g. G' }],
      description: 'Creates a new isolated vertex with the given label, or reports a miss when the label is already used.',
      best: { symbol: 'Ω(1)', text: 'a label index resolves the lookup in constant time' },
      average: { symbol: 'Θ(1)', text: 'constant time with a label index' },
      worst: { symbol: 'O(1)', text: 'no traversal of existing vertices is required' },
    },
    addEdge: {
      signature: 'addEdge(from, to, weight)',
      label: 'Add edge',
      fields: [
        { name: 'from', label: 'From', type: 'string', placeholder: 'e.g. A' },
        { name: 'to', label: 'To', type: 'string', placeholder: 'e.g. B' },
        { name: 'weight', label: 'Weight', type: 'number', placeholder: 'e.g. 5', required: false },
      ],
      description: 'Connects two existing vertices with an edge; an empty or non-finite weight defaults to 1.',
      best: { symbol: 'Ω(1)', text: 'label lookup and a single append' },
      average: { symbol: 'Θ(1)', text: 'constant-time label and id lookups, then append' },
      worst: { symbol: 'O(1)', text: 'no scan of the edge list is performed' },
    },
    removeVertex: {
      signature: 'removeVertex(label)',
      label: 'Remove vertex',
      fields: [{ name: 'label', label: 'Label', type: 'string', placeholder: 'e.g. A' }],
      description: 'Removes a vertex together with every edge incident to it.',
      best: { symbol: 'Ω(1)', text: 'an isolated vertex needs no edge cleanup' },
      average: { symbol: 'Θ(V+E)', text: 'find the vertex and filter its incident edges' },
      worst: { symbol: 'O(V+E)', text: 'the vertex is connected to the whole graph' },
    },
    removeEdge: {
      signature: 'removeEdge(from, to)',
      label: 'Remove edge',
      fields: [
        { name: 'from', label: 'From', type: 'string', placeholder: 'e.g. A' },
        { name: 'to', label: 'To', type: 'string', placeholder: 'e.g. B' },
      ],
      description: 'Removes the connection between two vertices; directed mode needs the exact orientation.',
      best: { symbol: 'Ω(1)', text: 'the edge is the first one inspected' },
      average: { symbol: 'Θ(E)', text: 'scan the adjacency list for a matching edge' },
      worst: { symbol: 'O(E)', text: 'the edge is absent or last' },
    },
    bfs: {
      signature: 'bfs(start)',
      label: 'Breadth-first search',
      fields: [{ name: 'start', label: 'Start', type: 'string', placeholder: 'e.g. A' }],
      description: 'Explores the graph level by level from the start vertex using a queue.',
      best: { symbol: 'Ω(V+E)', text: 'a full traversal still scans vertices and adjacency lists' },
      average: { symbol: 'Θ(V+E)', text: 'each vertex and edge is processed once' },
      worst: { symbol: 'O(V+E)', text: 'every vertex and edge is visited' },
    },
    dfs: {
      signature: 'dfs(start)',
      label: 'Depth-first search',
      fields: [{ name: 'start', label: 'Start', type: 'string', placeholder: 'e.g. A' }],
      description: 'Explores the graph by following each branch as deeply as possible before backtracking.',
      best: { symbol: 'Ω(V+E)', text: 'a full traversal still scans vertices and adjacency lists' },
      average: { symbol: 'Θ(V+E)', text: 'each vertex and edge is processed once' },
      worst: { symbol: 'O(V+E)', text: 'every vertex and edge is visited' },
    },
    dijkstra: {
      signature: 'dijkstra(start, target?)',
      label: 'Dijkstra shortest paths',
      fields: [
        { name: 'start', label: 'Start', type: 'string', placeholder: 'e.g. A' },
        { name: 'target', label: 'Target (optional)', type: 'string', placeholder: 'e.g. F', required: false },
      ],
      description: 'Computes shortest weighted distances from the start vertex with a binary min-heap and reports every relaxation. All edge weights must be non-negative.',
      best: { symbol: 'Ω((V+E) log V)', text: 'the heap still orders every settled vertex' },
      average: { symbol: 'Θ((V+E) log V)', text: 'one push and pop per relaxation with logarithmic cost' },
      worst: {
        symbol: 'O((V+E) log V)',
        text: 'binary heap operations dominate; an array-based priority queue would be O(V²)',
      },
    },
    useDirected: {
      signature: 'useDirected()',
      label: 'Use directed',
      description: 'Switches the graph to directed mode and marks every existing edge as directed.',
      best: { symbol: 'Ω(1)', text: 'there are no edges to update' },
      average: { symbol: 'Θ(E)', text: 'flag each existing edge' },
      worst: { symbol: 'O(E)', text: 'every edge is updated' },
    },
    useUndirected: {
      signature: 'useUndirected()',
      label: 'Use undirected',
      description: 'Switches the graph to undirected mode and clears the direction flag on every edge.',
      best: { symbol: 'Ω(1)', text: 'there are no edges to update' },
      average: { symbol: 'Θ(E)', text: 'flag each existing edge' },
      worst: { symbol: 'O(E)', text: 'every edge is updated' },
    },
    useWeighted: {
      signature: 'useWeighted()',
      label: 'Use weighted',
      description: 'Switches the graph to weighted mode and gives any weightless edge a default weight of 1.',
      best: { symbol: 'Ω(1)', text: 'there are no edges to update' },
      average: { symbol: 'Θ(E)', text: 'assign a weight to each edge' },
      worst: { symbol: 'O(E)', text: 'every edge needs a weight' },
    },
    useUnweighted: {
      signature: 'useUnweighted()',
      label: 'Use unweighted',
      description: 'Switches the graph to unweighted mode and removes the weight from every edge.',
      best: { symbol: 'Ω(1)', text: 'there are no edges to update' },
      average: { symbol: 'Θ(E)', text: 'clear the weight of each edge' },
      worst: { symbol: 'O(E)', text: 'every edge is updated' },
    },
  },
};

export class Graph extends BaseStructure {
  static meta = meta;

  constructor() {
    super(meta, createInitialState());
    this._labelIndex = new Map();
    this._idIndex = new Map();
  }

  initialState() {
    return createInitialState();
  }

  /** Graph seeds its demo regardless of arguments, so clear must bypass seed. */
  clear() {
    this._resetIds();
    this.state = this.initialState();
    this._labelIndex = new Map();
    this._idIndex = new Map();
    return this;
  }

  seed(_values = []) {
    this._resetIds();
    this.state = this.initialState();
    this._labelIndex = new Map();
    this._idIndex = new Map();

    for (const label of DEMO_VERTICES) {
      const node = { id: this._createId('v'), value: label };
      this.state.nodes.push(node);
      this._labelIndex.set(label, node.id);
      this._idIndex.set(node.id, node);
    }

    for (const [from, to, weight] of DEMO_EDGES) {
      this.state.edges.push({
        from: this._labelIndex.get(from),
        to: this._labelIndex.get(to),
        weight,
        directed: this.state.directed,
      });
    }
    return this;
  }

  _nodeById(id) {
    return this._idIndex.get(id) ?? null;
  }

  _nodeByLabel(label) {
    const id = this._labelIndex.get(String(label));
    return id === undefined ? null : this._nodeById(id);
  }

  _labelForId(id) {
    return this._nodeById(id)?.value ?? id;
  }

  _neighbors(id) {
    const result = [];
    for (const edge of this.state.edges) {
      const directed = edge.directed ?? this.state.directed;
      if (edge.from === id) {
        result.push({ id: edge.to, weight: edge.weight, edge });
      } else if (!directed && edge.to === id) {
        result.push({ id: edge.from, weight: edge.weight, edge });
      }
    }
    return result;
  }

  _clearMarks() {
    for (const node of this.state.nodes) {
      delete node.visited;
      delete node.dist;
    }
  }

  _distTable(dist) {
    const table = {};
    for (const node of this.state.nodes) {
      const value = dist.get(node.id);
      table[node.value] = Number.isFinite(value) ? value : null;
    }
    return table;
  }

  _resolveWeight(weight) {
    const empty = weight === undefined || weight === null
      || (typeof weight === 'string' && weight.trim() === '');
    const numeric = empty ? NaN : Number(weight);
    return Number.isFinite(numeric) ? numeric : 1;
  }

  *addVertex(label) {
    const value = String(label ?? '');
    if (this._labelIndex.has(value)) {
      const existing = this._nodeByLabel(value);
      yield {
        type: 'miss',
        message: `Vertex ${value} already exists, so it was not added.`,
        focus: existing ? [existing.id] : [],
      };
      return existing?.id ?? null;
    }

    this._clearMarks();
    const node = { id: this._createId('v'), value };
    this.state.nodes.push(node);
    this._labelIndex.set(value, node.id);
    this._idIndex.set(node.id, node);
    yield {
      type: 'insert',
      message: `Added vertex ${value} to the graph.`,
      focus: [node.id],
    };
    yield {
      type: 'done',
      message: `The graph now contains ${this.state.nodes.length} vertices.`,
      focus: [node.id],
    };
    return node.id;
  }

  *addEdge(from, to, weight) {
    const source = this._nodeByLabel(from);
    const target = this._nodeByLabel(to);
    if (!source || !target) {
      const missing = source ? String(to) : String(from);
      yield {
        type: 'miss',
        message: `Vertex ${missing} is not in the graph, so the edge was not added.`,
        focus: [],
      };
      return null;
    }

    this._clearMarks();
    const resolved = this._resolveWeight(weight);
    const edge = {
      from: source.id,
      to: target.id,
      directed: this.state.directed,
    };
    if (this.state.weighted) edge.weight = resolved;
    this.state.edges.push(edge);
    yield {
      type: 'insert',
      message: this.state.weighted
        ? `Added edge ${source.value} to ${target.value} with weight ${resolved}.`
        : `Added unweighted edge ${source.value} to ${target.value}.`,
      focus: [source.id, target.id],
    };
    yield {
      type: 'done',
      message: `The graph now contains ${this.state.edges.length} edges.`,
      focus: [source.id, target.id],
    };
    return edge;
  }

  *removeVertex(label) {
    const value = String(label ?? '');
    const node = this._nodeByLabel(value);
    if (!node) {
      yield {
        type: 'miss',
        message: `Vertex ${value} is not in the graph, so nothing was removed.`,
        focus: [],
      };
      return null;
    }

    const incident = this.state.edges.filter(
      (edge) => edge.from === node.id || edge.to === node.id,
    );
    yield {
      type: 'remove',
      message: `Removing vertex ${node.value} and its ${incident.length} incident edge${incident.length === 1 ? '' : 's'}.`,
      focus: [node.id],
    };
    for (const edge of incident) {
      yield {
        type: 'remove',
        message: `Removing edge ${this._labelForId(edge.from)} to ${this._labelForId(edge.to)} incident to ${node.value}.`,
        focus: [edge.from, edge.to],
      };
    }

    this.state.nodes = this.state.nodes.filter((entry) => entry.id !== node.id);
    this.state.edges = this.state.edges.filter(
      (edge) => edge.from !== node.id && edge.to !== node.id,
    );
    delete this.state.pinned[node.id];
    this._labelIndex.delete(value);
    this._idIndex.delete(node.id);
    yield {
      type: 'done',
      message: `The graph now contains ${this.state.nodes.length} vertices and ${this.state.edges.length} edges.`,
      focus: [],
    };
    return node.id;
  }

  *removeEdge(from, to) {
    const source = this._nodeByLabel(from);
    const target = this._nodeByLabel(to);
    if (!source || !target) {
      const missing = source ? String(to) : String(from);
      yield {
        type: 'miss',
        message: `Vertex ${missing} is not in the graph, so no edge was removed.`,
        focus: [],
      };
      return 0;
    }

    const matches = this.state.edges.filter((edge) => {
      const exact = edge.from === source.id && edge.to === target.id;
      if (edge.directed ?? this.state.directed) return exact;
      return exact || (edge.from === target.id && edge.to === source.id);
    });
    if (matches.length === 0) {
      yield {
        type: 'miss',
        message: `No edge connects ${source.value} and ${target.value}, so nothing was removed.`,
        focus: [source.id, target.id],
      };
      return 0;
    }

    this._clearMarks();
    for (const edge of matches) {
      yield {
        type: 'remove',
        message: `Removing edge ${this._labelForId(edge.from)} to ${this._labelForId(edge.to)}.`,
        focus: [edge.from, edge.to],
      };
    }
    const removed = new Set(matches);
    this.state.edges = this.state.edges.filter((edge) => !removed.has(edge));
    yield {
      type: 'done',
      message: `Removed ${matches.length} edge${matches.length === 1 ? '' : 's'} from the graph.`,
      focus: [source.id, target.id],
    };
    return matches.length;
  }

  *bfs(start) {
    this._clearMarks();
    const source = this._nodeByLabel(start);
    if (!source) {
      yield {
        type: 'miss',
        message: `Start vertex ${String(start)} is not in the graph.`,
        focus: [],
      };
      return [];
    }

    const visited = new Set([source.id]);
    const levels = new Map([[source.id, 0]]);
    const queue = [source.id];
    const order = [];
    let head = 0;

    while (head < queue.length) {
      const id = queue[head++];
      const node = this._nodeById(id);
      const level = levels.get(id);
      node.visited = true;
      order.push(node.value);
      yield {
        type: 'visit',
        message: `Visiting vertex ${node.value} at level ${level}.`,
        focus: [id],
        payload: { vertex: node.value, level, order: [...order] },
      };
      for (const neighbor of this._neighbors(id)) {
        if (visited.has(neighbor.id)) continue;
        visited.add(neighbor.id);
        levels.set(neighbor.id, level + 1);
        queue.push(neighbor.id);
      }
    }

    const levelTable = {};
    for (const [id, level] of levels) levelTable[this._nodeById(id).value] = level;
    yield {
      type: 'done',
      message: `Breadth-first search visited ${order.length} vertex${order.length === 1 ? '' : 'es'}.`,
      focus: [...visited],
      payload: { order, levels: levelTable },
    };
    return order;
  }

  *dfs(start) {
    this._clearMarks();
    const source = this._nodeByLabel(start);
    if (!source) {
      yield {
        type: 'miss',
        message: `Start vertex ${String(start)} is not in the graph.`,
        focus: [],
      };
      return [];
    }

    const visited = new Set();
    const order = [];
    const enter = (id) => {
      const node = this._nodeById(id);
      node.visited = true;
      visited.add(id);
      order.push(node.value);
      return {
        type: 'visit',
        message: `Visiting vertex ${node.value} in depth-first order.`,
        focus: [id],
        payload: { vertex: node.value, index: order.length - 1, order: [...order] },
      };
    };

    yield enter(source.id);
    const stack = [{ id: source.id, neighbors: this._neighbors(source.id), index: 0 }];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (frame.index >= frame.neighbors.length) {
        stack.pop();
        continue;
      }
      const next = frame.neighbors[frame.index++];
      if (visited.has(next.id)) continue;
      yield enter(next.id);
      stack.push({ id: next.id, neighbors: this._neighbors(next.id), index: 0 });
    }

    yield {
      type: 'done',
      message: `Depth-first search visited ${order.length} vertex${order.length === 1 ? '' : 'es'}.`,
      focus: [...visited],
      payload: { order },
    };
    return order;
  }

  *dijkstra(start, target) {
    this._clearMarks();
    const source = this._nodeByLabel(start);
    if (!source) {
      yield {
        type: 'miss',
        message: `Start vertex ${String(start)} is not in the graph.`,
        focus: [],
      };
      return {};
    }

    const negative = this.state.edges.find((edge) => Number.isFinite(edge.weight) && edge.weight < 0);
    if (negative) {
      yield {
        type: 'miss',
        message: 'Dijkstra requires non-negative edge weights; a negative edge was found.',
        focus: [negative.from, negative.to],
      };
      return {};
    }

    const dist = new Map(this.state.nodes.map((node) => [node.id, Infinity]));
    dist.set(source.id, 0);
    this._nodeById(source.id).dist = 0;
    const heap = new MinHeap();
    heap.push(0, source.id);
    const settled = new Set();
    const previous = new Map();
    const order = [];

    while (heap.size > 0) {
      const entry = heap.pop();
      if (settled.has(entry.id) || entry.dist !== dist.get(entry.id)) continue;
      settled.add(entry.id);

      const node = this._nodeById(entry.id);
      node.dist = entry.dist;
      order.push(node.value);
      yield {
        type: 'visit',
        message: `Settling vertex ${node.value} with final distance ${entry.dist}.`,
        focus: [entry.id],
        payload: { vertex: node.value, dist: entry.dist, distances: this._distTable(dist) },
      };

      for (const neighbor of this._neighbors(entry.id)) {
        if (settled.has(neighbor.id)) continue;
        const weight = Number.isFinite(neighbor.weight) ? neighbor.weight : 1;
        const candidate = entry.dist + weight;
        if (candidate >= dist.get(neighbor.id)) continue;

        dist.set(neighbor.id, candidate);
        previous.set(neighbor.id, entry.id);
        this._nodeById(neighbor.id).dist = candidate;
        heap.push(candidate, neighbor.id);
        yield {
          type: 'relax',
          message: `Relaxed edge ${node.value} to ${this._labelForId(neighbor.id)}: distance ${candidate} is shorter.`,
          focus: [entry.id, neighbor.id],
          payload: {
            from: node.value,
            to: this._labelForId(neighbor.id),
            weight,
            dist: candidate,
            distances: this._distTable(dist),
          },
        };
      }
    }

    const distances = this._distTable(dist);
    const label = target === undefined || target === null ? '' : String(target).trim();
    const destination = label === '' ? null : this._nodeByLabel(label);
    let message = `Dijkstra finished with shortest distances from ${source.value}.`;
    let pathInfo = {};

    if (label !== '' && !destination) {
      message = `Vertex ${label} does not exist; showing distances from ${source.value}.`;
    } else if (destination) {
      if (!settled.has(destination.id)) {
        message = `No path exists from ${source.value} to ${destination.value}.`;
        pathInfo = { path: [], target: destination.value };
      } else {
        const ids = [];
        let cursor = destination.id;
        while (cursor !== undefined && cursor !== null) {
          ids.unshift(cursor);
          cursor = previous.get(cursor);
        }
        const connects = (edge, a, b) => (edge.from === a && edge.to === b)
          || (!(edge.directed ?? this.state.directed) && edge.from === b && edge.to === a);
        const pathEdges = [];
        for (let index = 1; index < ids.length; index += 1) {
          const edge = this.state.edges.find((item) => connects(item, ids[index - 1], ids[index]));
          if (edge) pathEdges.push({ from: edge.from, to: edge.to });
        }
        const path = ids.map((id) => this._labelForId(id));
        const pathDistance = dist.get(destination.id);
        message = `Shortest path from ${source.value} to ${destination.value}: ${path.join(' → ')} (total ${pathDistance}).`;
        pathInfo = { path, pathIds: ids, pathEdges, pathDistance, target: destination.value };
      }
    }

    yield {
      type: 'done',
      message,
      focus: pathInfo.pathIds ?? this.state.nodes
        .filter((node) => Number.isFinite(dist.get(node.id)))
        .map((node) => node.id),
      payload: { distances, distTable: distances, order, ...pathInfo },
    };
    return distances;
  }

  *useDirected() {
    this._clearMarks();
    this.state.directed = true;
    for (const edge of this.state.edges) edge.directed = true;
    yield {
      type: 'info',
      message: 'The graph now treats every edge as directed.',
      focus: this.state.nodes.map((node) => node.id),
    };
    return this;
  }

  *useUndirected() {
    this._clearMarks();
    this.state.directed = false;
    for (const edge of this.state.edges) edge.directed = false;
    yield {
      type: 'info',
      message: 'The graph now treats every edge as undirected.',
      focus: this.state.nodes.map((node) => node.id),
    };
    return this;
  }

  *useWeighted() {
    this._clearMarks();
    this.state.weighted = true;
    for (const edge of this.state.edges) {
      if (!Number.isFinite(edge.weight)) edge.weight = 1;
    }
    yield {
      type: 'info',
      message: 'The graph now uses weighted edges and missing weights default to 1.',
      focus: this.state.nodes.map((node) => node.id),
    };
    return this;
  }

  *useUnweighted() {
    this._clearMarks();
    this.state.weighted = false;
    for (const edge of this.state.edges) delete edge.weight;
    yield {
      type: 'info',
      message: 'The graph now treats every edge as unweighted.',
      focus: this.state.nodes.map((node) => node.id),
    };
    return this;
  }
}
