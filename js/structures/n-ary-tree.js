import { BaseStructure } from '../core/BaseStructure.js';

export const meta = {
  id: 'n-ary-tree',
  title: 'N-ary Tree',
  group: 'Trees',
  layout: 'tree',
  description: 'A rooted tree in which every node may have any number of children. Each edge links a parent to one of its children, so the structure can model hierarchies with wide or deep branching.',
  demo: [1, 2, 3, 4, 5, 6, 7],
  operations: {
    insert: {
      signature: 'insert(value)',
      label: 'Insert',
      fields: [{ name: 'value', label: 'Value', type: 'number', placeholder: 'e.g. 42' }],
      description: 'Creates the root when the tree is empty; otherwise appends the value as one more child of the root.',
      best: { symbol: 'Ω(1)', text: 'the root is already known' },
      average: { symbol: 'Θ(1)', text: 'constant time' },
      worst: { symbol: 'O(1)', text: 'constant time' },
    },
    insertChild: {
      signature: 'insertChild(parentValue, value)',
      label: 'Insert child',
      fields: [
        { name: 'parentValue', label: 'Parent value', type: 'number', placeholder: 'e.g. 1' },
        { name: 'value', label: 'Value', type: 'number', placeholder: 'e.g. 42' },
      ],
      description: 'Finds the first node holding parentValue and appends value as one of its children, or reports a miss when no such parent exists.',
      best: { symbol: 'Ω(1)', text: 'the parent is the first node visited' },
      average: { symbol: 'Θ(n)', text: 'visit nodes until the parent is found' },
      worst: { symbol: 'O(n)', text: 'the parent is absent or last' },
    },
    search: {
      signature: 'search(value)',
      label: 'Search',
      fields: [{ name: 'value', label: 'Value', type: 'number', placeholder: 'e.g. 42' }],
      description: 'Visits nodes in depth-first order until the requested value is found or the whole tree has been checked.',
      best: { symbol: 'Ω(1)', text: 'the value is stored in the root' },
      average: { symbol: 'Θ(n)', text: 'inspect part of the tree' },
      worst: { symbol: 'O(n)', text: 'the value is absent or stored in the last node' },
    },
    delete: {
      signature: 'delete(value)',
      label: 'Delete',
      fields: [{ name: 'value', label: 'Value', type: 'number', placeholder: 'e.g. 42' }],
      description: 'Removes the first node holding value together with its entire subtree; deleting the root clears the tree.',
      best: { symbol: 'Ω(1)', text: 'the matching node is the root' },
      average: { symbol: 'Θ(n)', text: 'find the node and collect its subtree' },
      worst: { symbol: 'O(n)', text: 'the value is absent or the subtree spans the tree' },
    },
    bfs: {
      signature: 'bfs()',
      label: 'Breadth-first traversal',
      description: 'Visits every node level by level from left to right, starting at the root.',
      best: { symbol: 'Ω(n)', text: 'every node must be visited' },
      average: { symbol: 'Θ(n)', text: 'one pass over all nodes' },
      worst: { symbol: 'O(n)', text: 'one pass over all nodes' },
    },
    dfs: {
      signature: 'dfs()',
      label: 'Depth-first traversal',
      description: 'Visits the root and then explores each child subtree completely before moving to the next child.',
      best: { symbol: 'Ω(n)', text: 'every node must be visited' },
      average: { symbol: 'Θ(n)', text: 'one pass over all nodes' },
      worst: { symbol: 'O(n)', text: 'one pass over all nodes' },
    },
  },
};

export class NaryTree extends BaseStructure {
  static meta = meta;

  constructor() {
    super(meta, { root: null, nodes: [], edges: [] });
  }

  initialState() {
    return { root: null, nodes: [], edges: [] };
  }

  seed(values = []) {
    this._resetIds();
    this.state = this.initialState();
    if (values.length === 0) return this;

    const root = this._addNode(values[0]);
    this.state.root = root.id;
    for (const value of values.slice(1)) {
      const child = this._addNode(value);
      this.state.edges.push({ from: root.id, to: child.id });
    }
    return this;
  }

  _addNode(value) {
    const node = { id: this._createId('n'), value };
    this.state.nodes.push(node);
    return node;
  }

  _nodeById(id) {
    return this.state.nodes.find((node) => node.id === id) ?? null;
  }

  _childrenOf(id) {
    return this.state.edges
      .filter((edge) => edge.from === id)
      .map((edge) => this._nodeById(edge.to))
      .filter(Boolean);
  }

  _orderedNodes() {
    const order = [];
    if (this.state.root === null) return order;
    const seen = new Set();
    const visit = (id) => {
      if (seen.has(id)) return;
      const node = this._nodeById(id);
      if (!node) return;
      seen.add(id);
      order.push(node);
      for (const child of this._childrenOf(id)) visit(child.id);
    };
    visit(this.state.root);
    return order;
  }

  _subtreeIds(id) {
    const ids = new Set();
    const queue = [id];
    while (queue.length > 0) {
      const current = queue.shift();
      if (ids.has(current)) continue;
      if (!this._nodeById(current)) continue;
      ids.add(current);
      for (const child of this._childrenOf(current)) queue.push(child.id);
    }
    return ids;
  }

  _bfsOrder() {
    if (this.state.root === null) return [];
    const order = [];
    const seen = new Set();
    const queue = [this.state.root];
    while (queue.length > 0) {
      const id = queue.shift();
      if (seen.has(id)) continue;
      const node = this._nodeById(id);
      if (!node) continue;
      seen.add(id);
      order.push(node);
      for (const child of this._childrenOf(id)) queue.push(child.id);
    }
    return order;
  }

  _sizeMessage() {
    const count = this.state.nodes.length;
    return count === 1 ? 'The tree now contains 1 node.' : `The tree now contains ${count} nodes.`;
  }

  *insert(value) {
    if (this.state.root === null) {
      const node = this._addNode(value);
      this.state.root = node.id;
      yield {
        type: 'insert',
        message: `Inserted ${value} as the root of the empty tree.`,
        focus: [node.id],
      };
      yield { type: 'done', message: this._sizeMessage(), focus: [node.id] };
      return node.id;
    }

    const root = this._nodeById(this.state.root);
    const node = this._addNode(value);
    this.state.edges.push({ from: root.id, to: node.id });
    yield {
      type: 'insert',
      message: `Inserted ${value} as a child of the root ${root.value}.`,
      focus: [node.id, root.id],
    };
    yield { type: 'done', message: this._sizeMessage(), focus: [node.id] };
    return node.id;
  }

  *insertChild(parentValue, value) {
    for (const node of this._orderedNodes()) {
      yield {
        type: 'visit',
        message: `Visiting node ${node.value} while looking for parent ${parentValue}.`,
        focus: [node.id],
      };
      if (node.value === parentValue) {
        const child = this._addNode(value);
        this.state.edges.push({ from: node.id, to: child.id });
        yield {
          type: 'insert',
          message: `Inserted ${value} as a child of ${parentValue}.`,
          focus: [child.id, node.id],
        };
        yield { type: 'done', message: this._sizeMessage(), focus: [child.id] };
        return child.id;
      }
    }

    yield {
      type: 'miss',
      message: `Parent ${parentValue} was not found, so ${value} was not inserted.`,
      focus: [],
    };
    return null;
  }

  *search(value) {
    for (const node of this._orderedNodes()) {
      yield {
        type: 'visit',
        message: `Visiting node ${node.value} while searching for ${value}.`,
        focus: [node.id],
      };
      if (node.value === value) {
        yield {
          type: 'found',
          message: `Found value ${value} at node ${node.id}.`,
          focus: [node.id],
        };
        return node.id;
      }
    }

    yield {
      type: 'miss',
      message: `Value ${value} is not present in the tree.`,
      focus: [],
    };
    return null;
  }

  *delete(value) {
    const order = this._orderedNodes();
    let target = null;
    for (const node of order) {
      yield {
        type: 'visit',
        message: `Visiting node ${node.value} while looking for ${value}.`,
        focus: [node.id],
      };
      if (node.value === value) {
        target = node;
        break;
      }
    }

    if (!target) {
      yield {
        type: 'miss',
        message: `Value ${value} was not found, so nothing was removed.`,
        focus: [],
      };
      return null;
    }

    const subtree = this._subtreeIds(target.id);
    for (const node of order.filter((entry) => subtree.has(entry.id))) {
      yield {
        type: 'remove',
        message: node.id === target.id
          ? `Removing node ${node.value} together with its whole subtree.`
          : `Removing descendant node ${node.value} as part of the subtree.`,
        focus: node.id === target.id ? [...subtree] : [node.id],
      };
    }

    this.state.nodes = this.state.nodes.filter((node) => !subtree.has(node.id));
    this.state.edges = this.state.edges.filter(
      (edge) => !subtree.has(edge.from) && !subtree.has(edge.to),
    );
    if (subtree.has(this.state.root)) this.state.root = null;

    yield {
      type: 'done',
      message: this.state.root === null
        ? 'The tree is now empty.'
        : this._sizeMessage(),
      focus: this.state.root ? [this.state.root] : [],
    };
    return target.id;
  }

  *bfs() {
    const order = this._bfsOrder();
    if (order.length === 0) {
      yield {
        type: 'done',
        message: 'The tree is empty, so there is nothing to traverse.',
        focus: [],
      };
      return [];
    }

    for (const node of order) {
      yield {
        type: 'visit',
        message: `Visiting node ${node.value} in breadth-first order.`,
        focus: [node.id],
      };
    }
    yield {
      type: 'done',
      message: `Visited ${order.length} node${order.length === 1 ? '' : 's'} in breadth-first order.`,
      focus: order.map((node) => node.id),
    };
    return order.map((node) => node.value);
  }

  *dfs() {
    const order = this._orderedNodes();
    if (order.length === 0) {
      yield {
        type: 'done',
        message: 'The tree is empty, so there is nothing to traverse.',
        focus: [],
      };
      return [];
    }

    for (const node of order) {
      yield {
        type: 'visit',
        message: `Visiting node ${node.value} in depth-first order.`,
        focus: [node.id],
      };
    }
    yield {
      type: 'done',
      message: `Visited ${order.length} node${order.length === 1 ? '' : 's'} in depth-first order.`,
      focus: order.map((node) => node.id),
    };
    return order.map((node) => node.value);
  }
}
