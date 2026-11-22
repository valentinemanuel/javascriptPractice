import { BaseStructure } from '../core/BaseStructure.js';

export const meta = {
  id: 'avl',
  title: 'AVL Tree',
  group: 'Trees',
  layout: 'tree',
  description:
    'A self-balancing binary search tree. For every node the heights of the left and right subtrees differ by at most one; height is measured with an empty subtree at 0 and a leaf at 1, and balance is height(left) minus height(right). Duplicate values are ignored.',
  demo: [30, 20, 40, 10, 25, 35, 50],
  operations: {
    insert: {
      signature: 'insert(value)',
      label: 'Insert',
      fields: [{ name: 'value', label: 'Value', type: 'number', placeholder: 'e.g. 30' }],
      description:
        'Inserts a value with binary-search-tree ordering, then restores balance with an LL, LR, RL or RR rotation. Each rotation itself takes constant time.',
      best: { symbol: 'Ω(log n)', text: 'the new leaf is placed after a logarithmic descent' },
      average: { symbol: 'Θ(log n)', text: 'the search path and rebalancing are logarithmic' },
      worst: { symbol: 'O(log n)', text: 'the tree height stays logarithmic because it is balanced' },
    },
    delete: {
      signature: 'delete(value)',
      label: 'Delete',
      fields: [{ name: 'value', label: 'Value', type: 'number', placeholder: 'e.g. 20' }],
      description:
        'Removes a value, replacing a two-child node with its in-order successor, then rebalances every ancestor on the way back up with an LL, LR, RL or RR rotation. Each rotation itself takes constant time.',
      best: { symbol: 'Ω(log n)', text: 'the node is found after a logarithmic descent' },
      average: { symbol: 'Θ(log n)', text: 'the search path and rebalancing are logarithmic' },
      worst: { symbol: 'O(log n)', text: 'the tree height stays logarithmic because it is balanced' },
    },
    search: {
      signature: 'search(value)',
      label: 'Search',
      fields: [{ name: 'value', label: 'Value', type: 'number', placeholder: 'e.g. 25' }],
      description: 'Follows the binary search tree comparison path to find a value or report that it is missing.',
      best: { symbol: 'Ω(log n)', text: 'the value is found near the root of the balanced tree' },
      average: { symbol: 'Θ(log n)', text: 'the comparison path is logarithmic' },
      worst: { symbol: 'O(log n)', text: 'the comparison path follows the logarithmic tree height' },
    },
  },
  rotation: {
    description: 'A single or double rotation rearranges a constant number of pointers.',
    best: { symbol: 'Ω(1)', text: 'a fixed number of pointer updates' },
    average: { symbol: 'Θ(1)', text: 'constant time' },
    worst: { symbol: 'O(1)', text: 'constant time' },
  },
};

export class AvlTree extends BaseStructure {
  static meta = meta;

  constructor() {
    super(meta, { root: null, nodes: [], edges: [] });
    this._nodes = new Map();
    this._root = null;
  }

  initialState() {
    return { root: null, nodes: [], edges: [] };
  }

  seed(values = []) {
    this._nodes = new Map();
    this._root = null;
    for (const value of values) {
      for (const _step of this.insert(value)) {
        // Seeding only needs the resulting structure, not the step stream.
      }
    }
    this._syncState();
    return this;
  }

  // ---------------------------------------------------------------- state ---

  _get(id) {
    const node = this._nodes.get(id);
    if (!node) throw new Error(`Unknown node id: ${id}`);
    return node;
  }

  _heightOf(id) {
    if (id === null || id === undefined) return 0;
    const node = this._nodes.get(id);
    return node ? node.height : 0;
  }

  _createNode(value) {
    const id = this._createId('n');
    const node = { id, value, height: 1, balance: 0, left: null, right: null };
    this._nodes.set(id, node);
    return node;
  }

  _update(id) {
    const node = this._get(id);
    const leftHeight = this._heightOf(node.left);
    const rightHeight = this._heightOf(node.right);
    node.height = 1 + Math.max(leftHeight, rightHeight);
    node.balance = leftHeight - rightHeight;
  }

  _balance(id) {
    const node = this._get(id);
    return this._heightOf(node.left) - this._heightOf(node.right);
  }

  _normalizeHeights() {
    const postOrder = [];
    const stack = [this._root];
    while (stack.length) {
      const id = stack.pop();
      if (id === null || !this._nodes.has(id)) continue;
      const node = this._nodes.get(id);
      postOrder.push(id);
      stack.push(node.left, node.right);
    }
    for (let index = postOrder.length - 1; index >= 0; index -= 1) {
      this._update(postOrder[index]);
    }
  }

  _syncState() {
    const nodes = [];
    const edges = [];
    const walk = (id) => {
      if (id === null || id === undefined) return;
      const node = this._nodes.get(id);
      if (!node) return;
      walk(node.left);
      nodes.push({ id: node.id, value: node.value, height: node.height, balance: node.balance });
      if (node.left !== null && this._nodes.has(node.left)) {
        edges.push({ from: node.id, to: node.left, side: 'left' });
      }
      if (node.right !== null && this._nodes.has(node.right)) {
        edges.push({ from: node.id, to: node.right, side: 'right' });
      }
      walk(node.right);
    };
    walk(this._root);
    this.state.root = this._root;
    this.state.nodes = nodes;
    this.state.edges = edges;
  }

  /**
   * Relink the subtree root immediately so every emitted state stays reachable
   * from the canonical root, including intermediate rotation steps.
   */
  _relink(id, replacement) {
    if (this._root === id) {
      this._root = replacement;
      return;
    }
    for (const node of this._nodes.values()) {
      if (node.left === id) {
        node.left = replacement;
        return;
      }
      if (node.right === id) {
        node.right = replacement;
        return;
      }
    }
  }

  _emit(type, message, focus = []) {
    this._normalizeHeights();
    this._syncState();
    return { type, message, focus };
  }

  // ------------------------------------------------------------ rotations ---

  _rotateLeft(xId) {
    const x = this._get(xId);
    const yId = x.right;
    const y = this._get(yId);
    x.right = y.left;
    y.left = xId;
    this._update(xId);
    this._update(yId);
    return yId;
  }

  _rotateRight(yId) {
    const y = this._get(yId);
    const xId = y.left;
    const x = this._get(xId);
    y.left = x.right;
    x.right = yId;
    this._update(yId);
    this._update(xId);
    return xId;
  }

  *_rebalance(id, context) {
    const node = this._get(id);
    const balance = this._balance(id);

    if (balance > 1) {
      const leftId = node.left;
      const leftValue = this._get(leftId).value;
      const single = context.operation === 'insert'
        ? context.value < leftValue
        : this._balance(leftId) >= 0;
      let newRoot;
      if (single) {
        newRoot = this._rotateRight(id);
        this._relink(id, newRoot);
        yield this._emit(
          'rotate',
          `Left-Left (LL) rotation performed at node ${node.value}.`,
          [newRoot, id],
        );
      } else {
        node.left = this._rotateLeft(leftId);
        newRoot = this._rotateRight(id);
        this._relink(id, newRoot);
        yield this._emit(
          'rotate',
          `Left-Right (LR) rotation performed at node ${node.value}.`,
          [newRoot, leftId, id],
        );
      }
      return newRoot;
    }

    if (balance < -1) {
      const rightId = node.right;
      const rightValue = this._get(rightId).value;
      const single = context.operation === 'insert'
        ? context.value > rightValue
        : this._balance(rightId) <= 0;
      let newRoot;
      if (single) {
        newRoot = this._rotateLeft(id);
        this._relink(id, newRoot);
        yield this._emit(
          'rotate',
          `Right-Right (RR) rotation performed at node ${node.value}.`,
          [newRoot, id],
        );
      } else {
        node.right = this._rotateRight(rightId);
        newRoot = this._rotateLeft(id);
        this._relink(id, newRoot);
        yield this._emit(
          'rotate',
          `Right-Left (RL) rotation performed at node ${node.value}.`,
          [newRoot, rightId, id],
        );
      }
      return newRoot;
    }

    return id;
  }

  // ------------------------------------------------------------- insert ---

  *_insertAt(id, value, result) {
    if (id === null) {
      const node = this._createNode(value);
      result.created = node;
      result.root = node.id;
      return;
    }

    const node = this._get(id);
    yield this._emit('compare', `Comparing ${value} with ${node.value}.`, [id]);

    if (value === node.value) {
      result.duplicate = true;
      result.root = id;
      yield this._emit('miss', `${value} is already in the tree, so no node was added.`, [id]);
      return;
    }

    if (value < node.value) {
      yield* this._insertAt(node.left, value, result);
      node.left = result.root;
    } else {
      yield* this._insertAt(node.right, value, result);
      node.right = result.root;
    }

    this._update(id);
    result.root = yield* this._rebalance(id, { operation: 'insert', value });
  }

  *insert(value) {
    const result = { root: this._root, created: null, duplicate: false };
    yield* this._insertAt(this._root, value, result);
    this._root = result.root;

    if (result.created) {
      yield this._emit('insert', `Inserted ${value} as a new node.`, [result.created.id]);
    }
    yield this._emit(
      result.duplicate ? 'miss' : 'done',
      result.duplicate
        ? `${value} was not inserted because duplicate values are ignored.`
        : `${value} is inserted and the tree remains balanced.`,
      result.duplicate ? [] : [this._root],
    );
    this._syncState();
    return !result.duplicate;
  }

  // ------------------------------------------------------------- search ---

  *search(value) {
    let id = this._root;
    while (id !== null) {
      const node = this._get(id);
      yield this._emit('compare', `Comparing ${value} with ${node.value}.`, [id]);
      if (value === node.value) {
        yield this._emit('found', `Found ${value} in the tree.`, [id]);
        return true;
      }
      id = value < node.value ? node.left : node.right;
    }
    yield this._emit('miss', `${value} is not in the tree.`, []);
    return false;
  }

  // -------------------------------------------------------------- delete ---

  *_minNode(id) {
    let current = this._get(id);
    yield this._emit('visit', `Visiting ${current.value} while looking for the in-order successor.`, [current.id]);
    while (current.left !== null) {
      current = this._get(current.left);
      yield this._emit('visit', `Visiting ${current.value} while looking for the in-order successor.`, [current.id]);
    }
    return current;
  }

  *_removeMin(id) {
    const node = this._get(id);
    if (node.left === null) {
      const childId = node.right;
      this._relink(id, childId);
      this._nodes.delete(id);
      yield this._emit('delete', `Removed the successor node ${node.value}.`, []);
      return childId;
    }
    const childRoot = yield* this._removeMin(node.left);
    node.left = childRoot;
    this._update(id);
    return yield* this._rebalance(id, { operation: 'delete' });
  }

  *_deleteAt(id, value) {
    if (id === null) return { root: null, removed: false };

    const node = this._get(id);
    yield this._emit(
      'compare',
      `Comparing ${value} with ${node.value} while searching for the node to delete.`,
      [id],
    );

    if (value < node.value) {
      const result = yield* this._deleteAt(node.left, value);
      node.left = result.root;
      if (!result.removed) return { root: id, removed: false };
      this._update(id);
      return { root: yield* this._rebalance(id, { operation: 'delete' }), removed: true };
    }

    if (value > node.value) {
      const result = yield* this._deleteAt(node.right, value);
      node.right = result.root;
      if (!result.removed) return { root: id, removed: false };
      this._update(id);
      return { root: yield* this._rebalance(id, { operation: 'delete' }), removed: true };
    }

    yield this._emit('access', `Found ${value} at node ${node.value}; removing it now.`, [id]);

    if (node.left === null && node.right === null) {
      this._relink(id, null);
      this._nodes.delete(id);
      yield this._emit('delete', `Removed the leaf node ${value}.`, []);
      return { root: null, removed: true };
    }

    if (node.left === null) {
      const childId = node.right;
      this._relink(id, childId);
      this._nodes.delete(id);
      yield this._emit('delete', `Removed node ${value}; its right child took its place.`, [childId]);
      return { root: childId, removed: true };
    }

    if (node.right === null) {
      const childId = node.left;
      this._relink(id, childId);
      this._nodes.delete(id);
      yield this._emit('delete', `Removed node ${value}; its left child took its place.`, [childId]);
      return { root: childId, removed: true };
    }

    const successor = yield* this._minNode(node.right);
    const successorId = successor.id;
    const successorValue = successor.value;
    yield this._emit(
      'access',
      `The in-order successor of ${value} is ${successorValue}.`,
      [successorId],
    );
    node.value = successorValue;
    node.right = yield* this._removeMin(node.right);
    yield this._emit(
      'delete',
      `Replaced ${value} with its successor ${successorValue} and removed the successor node.`,
      [id],
    );
    this._update(id);
    return { root: yield* this._rebalance(id, { operation: 'delete' }), removed: true };
  }

  *delete(value) {
    const result = yield* this._deleteAt(this._root, value);
    this._root = result.root;
    if (result.removed) {
      yield this._emit('done', `Deleted ${value} and rebalanced the tree.`, this._root ? [this._root] : []);
    } else {
      yield this._emit('miss', `${value} was not found, so nothing was deleted.`, []);
    }
    this._syncState();
    return result.removed;
  }
}
