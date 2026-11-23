import { BaseStructure } from '../core/BaseStructure.js';

export const meta = {
  id: 'b-plus-tree',
  title: 'B+ Tree',
  group: 'Trees',
  layout: 'multiKey',
  description:
    'A B+ Tree stores sorted keys in linked leaves while internal nodes hold separator keys that guide descent. Every value lives in a leaf, and the leaves are chained left to right so range scans are fast. Insertion splits full leaves and propagates separators upward; deletion removes from the leaf, borrows or merges underfull leaves, and adjusts separators while propagating internal changes. Duplicate keys are ignored. Use the degree control to change t at any time: the tree rebuilds itself from its leaf keys with order 2t, rounded up to an even order so that merging two minimally filled nodes never overflows.',
  demo: [5, 10, 15, 20, 25, 30, 35],
  operations: {
    insert: {
      signature: 'insert(key)',
      label: 'Insert',
      fields: [{ name: 'key', label: 'Key', type: 'number', placeholder: 'e.g. 25' }],
      description: 'Inserts a key into the correct leaf, splitting leaves and propagating separators when nodes overflow.',
      best: { symbol: 'Ω(log_m n)', text: 'descend to a leaf with spare capacity' },
      average: { symbol: 'Θ(log_m n)', text: 'descend the height of the tree' },
      worst: { symbol: 'O(log n)', text: 'splits may propagate up to a new root' },
    },
    search: {
      signature: 'search(key)',
      label: 'Search',
      fields: [{ name: 'key', label: 'Key', type: 'number', placeholder: 'e.g. 25' }],
      description: 'Descends from the root using separator keys until the target leaf is reached, then reports whether the key is present.',
      best: { symbol: 'Ω(log_m n)', text: 'descend the height of the tree' },
      average: { symbol: 'Θ(log_m n)', text: 'one path from root to leaf' },
      worst: { symbol: 'O(log n)', text: 'the full height is examined' },
    },
    rangeQuery: {
      signature: 'rangeQuery(low, high)',
      label: 'Range query',
      fields: [
        { name: 'low', label: 'Low', type: 'number', placeholder: 'e.g. 10' },
        { name: 'high', label: 'High', type: 'number', placeholder: 'e.g. 40' },
      ],
      description: 'Descends once to the first candidate leaf and then follows the leaf chain, reporting every key between low and high inclusive.',
      best: { symbol: 'Ω(log_m n + k)', text: 'descend once, then report k keys' },
      average: { symbol: 'Θ(log_m n + k)', text: 'descend once and scan the matching leaves' },
      worst: { symbol: 'O(log n + k)', text: 'descend once and walk all leaves in the range' },
    },
    delete: {
      signature: 'delete(key)',
      label: 'Delete',
      fields: [{ name: 'key', label: 'Key', type: 'number', placeholder: 'e.g. 25' }],
      description: 'Removes a key from its leaf and rebalances by borrowing or merging underfull leaves, adjusting separators and propagating internal changes upward.',
      best: { symbol: 'Ω(log_m n)', text: 'descend and remove without underflow' },
      average: { symbol: 'Θ(log_m n)', text: 'descend, remove, and locally rebalance' },
      worst: { symbol: 'O(log n)', text: 'merges may propagate up to the root' },
    },
    useDegree: {
      signature: 'useDegree(t)',
      label: 'Set degree t',
      fields: [{ name: 't', label: 'Degree t', type: 'number', placeholder: 'e.g. 2' }],
      description: 'Rebuilds the tree with minimum degree t, so the maximum order becomes 2t and the leaf chain is rebuilt from the stored keys.',
      best: { symbol: 'Ω(n log n)', text: 'all n leaf keys are collected and reinserted into the new tree' },
      average: { symbol: 'Θ(n log n)', text: 'every key is reinserted into the new tree' },
      worst: { symbol: 'O(n log n)', text: 'all keys are reinserted with leaf splits' },
    },
  },
};

export class BPlusTree extends BaseStructure {
  static meta = meta;

  constructor(order = 4) {
    super(meta, { order, root: null, nodes: [], edges: [] });
    this._order = order;
    this._children = new Map();
  }

  initialState() {
    return { order: this._order, root: null, nodes: [], edges: [] };
  }

  reset(values = []) {
    this._children = new Map();
    return super.reset(values);
  }

  restore(state) {
    super.restore(state);
    const requested = Math.max(4, Math.floor(Number(this.state.order) || 4));
    this._order = requested % 2 === 0 ? requested : requested + 1;
    this.state.order = this._order;
    this._children = new Map();
    for (const node of this.state.nodes) {
      if (node.leaf) continue;
      const children = this.state.edges
        .filter((edge) => edge.from === node.id)
        .sort((a, b) => a.index - b.index)
        .map((edge) => edge.to);
      this._children.set(node.id, children);
    }
    return this;
  }

  seed(values = []) {
    for (const key of values) {
      // Reuse the insert generator; consuming it performs the mutations.
      for (const _step of this.insert(key)) { /* steps are ignored while seeding */ }
    }
    return this;
  }

  *useDegree(t) {
    const degree = Math.max(2, Math.floor(Number(t) || 2));
    const order = degree * 2;
    const keys = this.state.nodes
      .filter((node) => node.leaf)
      .flatMap((node) => node.keys)
      .sort((a, b) => a - b);

    this._order = order;
    this._resetIds();
    this._children = new Map();
    this.state = this.initialState();
    for (const key of keys) {
      for (const _step of this.insert(key)) { /* applied while rebuilding */ }
    }

    yield {
      type: 'visit',
      message: `Rebuilt the B+ tree with minimum degree ${degree} (order ${order}) and ${keys.length} key(s).`,
      focus: this.state.nodes.map((node) => node.id),
    };
    return order;
  }

  /* ------------------------------------------------------------------ */
  /* Internal helpers                                                    */
  /* ------------------------------------------------------------------ */

  _maxKeys() {
    return this._order - 1;
  }

  _minKeys() {
    return Math.floor(this._maxKeys() / 2);
  }

  _nodeById(id) {
    if (id === null || id === undefined) return null;
    return this.state.nodes.find((node) => node.id === id) ?? null;
  }

  _nodeExists(id) {
    return this.state.nodes.some((node) => node.id === id);
  }

  _createNode(keys, leaf) {
    const node = { id: this._createId('bp'), keys: [...keys], leaf, next: null };
    this.state.nodes.push(node);
    if (!leaf) this._children.set(node.id, []);
    return node;
  }

  _getChildren(id) {
    return [...(this._children.get(id) ?? [])];
  }

  _setChildren(id, children) {
    this._children.set(id, [...children]);
    this._rebuildEdges();
  }

  _rebuildEdges() {
    const edges = [];
    for (const node of this.state.nodes) {
      if (node.leaf) continue;
      const children = this._children.get(node.id) ?? [];
      children.forEach((childId, index) => {
        if (this._nodeExists(childId)) edges.push({ from: node.id, to: childId, index });
      });
    }
    this.state.edges = edges;
  }

  /**
   * In a B+ tree every separator is redundant: keys[i] is exactly the
   * smallest key stored in child i + 1. Rebuilding separators from the
   * child structure after a mutation keeps ancestors consistent even when a
   * leaf's minimum changes several levels below them.
   */
  _recomputeSeparators() {
    const cache = new Map();
    const minKeyOf = (id) => {
      if (cache.has(id)) return cache.get(id);
      const node = this._nodeById(id);
      let value;
      if (node.leaf) {
        value = node.keys.length > 0 ? node.keys[0] : undefined;
      } else {
        const children = this._getChildren(id);
        value = children.length > 0 ? minKeyOf(children[0]) : undefined;
      }
      cache.set(id, value);
      return value;
    };
    for (const node of this.state.nodes) {
      if (node.leaf) continue;
      const children = this._getChildren(node.id);
      node.keys = children.slice(1).map((childId) => minKeyOf(childId));
    }
    this._rebuildEdges();
  }

  _sortedPosition(keys, key) {
    let index = 0;
    while (index < keys.length && keys[index] < key) index += 1;
    return index;
  }

  /**
   * Returns the leaf that would contain key and the root-to-leaf path.
   * Each path entry records the internal node, the chosen child index and
   * the separator it was compared with (null when no separator was left).
   */
  _findLeaf(key) {
    const path = [];
    let currentId = this.state.root;
    while (currentId !== null && !this._nodeById(currentId).leaf) {
      const node = this._nodeById(currentId);
      const children = this._getChildren(currentId);
      let index = 0;
      while (index < node.keys.length && key >= node.keys[index]) index += 1;
      path.push({
        nodeId: node.id,
        childIndex: index,
        comparedKey: index < node.keys.length ? node.keys[index] : null,
      });
      currentId = children[index];
    }
    return { leafId: currentId, path };
  }

  *_describeDescent(key, path) {
    for (const { nodeId, childIndex, comparedKey } of path) {
      const message = comparedKey === null
        ? `At internal node ${nodeId}, key ${key} exceeds every separator, so descent continues into child ${childIndex}.`
        : `At internal node ${nodeId}, key ${key} is compared with separator ${comparedKey}, so descent continues into child ${childIndex}.`;
      yield { type: 'compare', message, focus: [nodeId] };
    }
  }

  /**
   * Inserts a separator and a new right sibling into the parent of leftId.
   * When there is no parent, a new root is created. A parent that overflows
   * is split, which may propagate further upward.
   */
  *_insertIntoParent(leftId, rightNode, separator, path) {
    if (path.length === 0) {
      const root = this._createNode([separator], false);
      this._setChildren(root.id, [leftId, rightNode.id]);
      this.state.root = root.id;
      yield {
        type: 'split',
        message: `The root split, so a new root was created with separator ${separator}.`,
        focus: [root.id, leftId, rightNode.id],
      };
      return;
    }

    const parentInfo = path[path.length - 1];
    const parent = this._nodeById(parentInfo.nodeId);
    const insertIndex = parentInfo.childIndex + 1;
    const children = this._getChildren(parent.id);
    children.splice(insertIndex, 0, rightNode.id);
    this._setChildren(parent.id, children);
    parent.keys.splice(insertIndex - 1, 0, separator);
    yield {
      type: 'split',
      message: `Separator ${separator} was inserted into internal node ${parent.id}.`,
      focus: [parent.id, rightNode.id],
    };

    if (parent.keys.length > this._maxKeys()) {
      yield* this._splitInternal(parent, path.slice(0, -1));
    }
  }

  /** Splits an overflowing internal node and promotes its middle separator. */
  *_splitInternal(node, pathToNode) {
    const children = this._getChildren(node.id);
    const mid = Math.floor(node.keys.length / 2);
    const promoted = node.keys[mid];
    const rightKeys = node.keys.slice(mid + 1);
    const leftChildren = children.slice(0, mid + 1);
    const rightChildren = children.slice(mid + 1);

    const right = this._createNode(rightKeys, false);
    this._setChildren(right.id, rightChildren);
    node.keys = node.keys.slice(0, mid);
    this._setChildren(node.id, leftChildren);
    yield {
      type: 'split',
      message: `Internal node ${node.id} split and promoted separator ${promoted}.`,
      focus: [node.id, right.id],
    };
    yield* this._insertIntoParent(node.id, right, promoted, pathToNode);
  }

  /** Rebalances an underfull leaf by borrowing or merging with a sibling. */
  *_fixLeafUnderflow(leaf, path) {
    const parentInfo = path[path.length - 1];
    const parent = this._nodeById(parentInfo.nodeId);
    const children = this._getChildren(parent.id);
    const index = children.indexOf(leaf.id);

    if (index > 0) {
      const left = this._nodeById(children[index - 1]);
      if (left.keys.length > this._minKeys()) {
        const moved = left.keys.pop();
        leaf.keys.unshift(moved);
        parent.keys[index - 1] = leaf.keys[0];
        this._rebuildEdges();
        yield {
          type: 'merge',
          message: `Borrowed key ${moved} from the left sibling into leaf ${leaf.id}.`,
          focus: [left.id, leaf.id],
        };
        return;
      }
    }

    if (index < children.length - 1) {
      const right = this._nodeById(children[index + 1]);
      if (right.keys.length > this._minKeys()) {
        const moved = right.keys.shift();
        leaf.keys.push(moved);
        parent.keys[index] = right.keys[0];
        this._rebuildEdges();
        yield {
          type: 'merge',
          message: `Borrowed key ${moved} from the right sibling into leaf ${leaf.id}.`,
          focus: [right.id, leaf.id],
        };
        return;
      }
    }

    let mergedId;
    let removedId;
    let removeChildIndex;
    let separatorIndex;
    if (index > 0) {
      const left = this._nodeById(children[index - 1]);
      left.keys.push(...leaf.keys);
      left.next = leaf.next;
      mergedId = left.id;
      removedId = leaf.id;
      removeChildIndex = index;
      separatorIndex = index - 1;
    } else {
      const right = this._nodeById(children[index + 1]);
      leaf.keys.push(...right.keys);
      leaf.next = right.next;
      mergedId = leaf.id;
      removedId = right.id;
      removeChildIndex = 1;
      separatorIndex = 0;
    }
    children.splice(removeChildIndex, 1);
    parent.keys.splice(separatorIndex, 1);
    this._setChildren(parent.id, children);
    this._children.delete(removedId);
    this.state.nodes = this.state.nodes.filter((node) => node.id !== removedId);
    this._rebuildEdges();
    yield {
      type: 'merge',
      message: `Merged leaf ${removedId} into leaf ${mergedId} and removed separator ${separatorIndex} from ${parent.id}.`,
      focus: [mergedId, parent.id],
    };

    if (parent.keys.length < this._minKeys()) {
      yield* this._fixInternalUnderflow(parent, path.slice(0, -1));
    }
  }

  /** Rebalances an underfull internal node by borrowing or merging. */
  *_fixInternalUnderflow(node, pathToNode) {
    if (pathToNode.length === 0) {
      const children = this._getChildren(node.id);
      if (children.length <= 1 && children.length > 0) {
        const newRootId = children[0];
        this.state.root = newRootId;
        this._children.delete(node.id);
        this.state.nodes = this.state.nodes.filter((candidate) => candidate.id !== node.id);
        this._rebuildEdges();
        yield {
          type: 'merge',
          message: `Root ${node.id} had a single child, so child ${newRootId} became the new root.`,
          focus: [newRootId],
        };
      }
      return;
    }

    const parentInfo = pathToNode[pathToNode.length - 1];
    const parent = this._nodeById(parentInfo.nodeId);
    const siblings = this._getChildren(parent.id);
    const index = siblings.indexOf(node.id);

    if (index > 0) {
      const left = this._nodeById(siblings[index - 1]);
      if (left.keys.length > this._minKeys()) {
        const separator = parent.keys[index - 1];
        const leftChildren = this._getChildren(left.id);
        const movedChild = leftChildren.pop();
        this._setChildren(left.id, leftChildren);
        const movedKey = left.keys.pop();
        node.keys.unshift(separator);
        const nodeChildren = this._getChildren(node.id);
        nodeChildren.unshift(movedChild);
        this._setChildren(node.id, nodeChildren);
        parent.keys[index - 1] = movedKey;
        this._rebuildEdges();
        yield {
          type: 'merge',
          message: `Borrowed a child from the left sibling of internal node ${node.id} and updated separator ${movedKey}.`,
          focus: [left.id, node.id],
        };
        return;
      }
    }

    if (index < siblings.length - 1) {
      const right = this._nodeById(siblings[index + 1]);
      if (right.keys.length > this._minKeys()) {
        const separator = parent.keys[index];
        const rightChildren = this._getChildren(right.id);
        const movedChild = rightChildren.shift();
        this._setChildren(right.id, rightChildren);
        const movedKey = right.keys.shift();
        node.keys.push(separator);
        const nodeChildren = this._getChildren(node.id);
        nodeChildren.push(movedChild);
        this._setChildren(node.id, nodeChildren);
        parent.keys[index] = movedKey;
        this._rebuildEdges();
        yield {
          type: 'merge',
          message: `Borrowed a child from the right sibling of internal node ${node.id} and updated separator ${movedKey}.`,
          focus: [right.id, node.id],
        };
        return;
      }
    }

    let mergeInto;
    let mergeFrom;
    let removeChildIndex;
    let separatorIndex;
    if (index > 0) {
      const left = this._nodeById(siblings[index - 1]);
      left.keys.push(parent.keys[index - 1]);
      const leftChildren = this._getChildren(left.id);
      leftChildren.push(...this._getChildren(node.id));
      this._setChildren(left.id, leftChildren);
      mergeInto = left.id;
      mergeFrom = node.id;
      removeChildIndex = index;
      separatorIndex = index - 1;
    } else {
      const right = this._nodeById(siblings[index + 1]);
      node.keys.push(parent.keys[index]);
      const nodeChildren = this._getChildren(node.id);
      nodeChildren.push(...this._getChildren(right.id));
      this._setChildren(node.id, nodeChildren);
      mergeInto = node.id;
      mergeFrom = right.id;
      removeChildIndex = 1;
      separatorIndex = 0;
    }
    siblings.splice(removeChildIndex, 1);
    parent.keys.splice(separatorIndex, 1);
    this._setChildren(parent.id, siblings);
    this._children.delete(mergeFrom);
    this.state.nodes = this.state.nodes.filter((candidate) => candidate.id !== mergeFrom);
    this._rebuildEdges();
    yield {
      type: 'merge',
      message: `Merged internal node ${mergeFrom} into ${mergeInto} and adjusted separator ${separatorIndex} in ${parent.id}.`,
      focus: [mergeInto, parent.id],
    };

    if (parent.keys.length < this._minKeys()) {
      yield* this._fixInternalUnderflow(parent, pathToNode.slice(0, -1));
    }
  }

  /* ------------------------------------------------------------------ */
  /* Public generators                                                   */
  /* ------------------------------------------------------------------ */

  *insert(key) {
    if (this.state.root === null) {
      const leaf = this._createNode([key], true);
      this.state.root = leaf.id;
      this._rebuildEdges();
      yield {
        type: 'insert',
        message: `Inserted ${key} as the first key of the empty tree.`,
        focus: [leaf.id],
      };
      yield {
        type: 'done',
        message: `Key ${key} is now stored in the root leaf ${leaf.id}.`,
        focus: [leaf.id],
      };
      return key;
    }

    const { leafId, path } = this._findLeaf(key);
    yield* this._describeDescent(key, path);
    const leaf = this._nodeById(leafId);

    const position = this._sortedPosition(leaf.keys, key);
    if (position < leaf.keys.length && leaf.keys[position] === key) {
      yield {
        type: 'miss',
        message: `Key ${key} is already present in leaf ${leaf.id}, so the duplicate was ignored.`,
        focus: [leaf.id],
      };
      return null;
    }

    leaf.keys.splice(position, 0, key);
    yield {
      type: 'insert',
      message: `Inserted ${key} into leaf ${leaf.id} at position ${position}.`,
      focus: [leaf.id],
    };

    if (leaf.keys.length > this._maxKeys()) {
      const splitAt = Math.ceil(leaf.keys.length / 2);
      const rightKeys = leaf.keys.splice(splitAt);
      const right = this._createNode(rightKeys, true);
      right.next = leaf.next;
      leaf.next = right.id;
      this._rebuildEdges();
      yield {
        type: 'split',
        message: `Leaf ${leaf.id} split into two leaves and ${right.keys[0]} became the new separator.`,
        focus: [leaf.id, right.id],
      };
      yield* this._insertIntoParent(leaf.id, right, right.keys[0], path);
    }

    this._recomputeSeparators();
    yield {
      type: 'done',
      message: `Insertion of ${key} is complete.`,
      focus: [],
    };
    return key;
  }

  *search(key) {
    if (this.state.root === null) {
      yield {
        type: 'miss',
        message: `The tree is empty, so ${key} was not found.`,
        focus: [],
      };
      return null;
    }

    const { leafId, path } = this._findLeaf(key);
    yield* this._describeDescent(key, path);
    const leaf = this._nodeById(leafId);
    const position = this._sortedPosition(leaf.keys, key);

    if (position < leaf.keys.length && leaf.keys[position] === key) {
      yield {
        type: 'found',
        message: `Found key ${key} in leaf ${leaf.id}.`,
        focus: [leaf.id],
      };
      return leafId;
    }

    yield {
      type: 'miss',
      message: `Key ${key} is not present in the tree.`,
      focus: [leaf.id],
    };
    return null;
  }

  *rangeQuery(low, high) {
    const results = [];
    if (this.state.root === null) {
      yield {
        type: 'miss',
        message: `The tree is empty, so the range from ${low} to ${high} contains no keys.`,
        focus: [],
      };
      return results;
    }
    if (low > high) {
      yield {
        type: 'miss',
        message: `The lower bound ${low} exceeds the upper bound ${high}, so the range is empty.`,
        focus: [],
      };
      return results;
    }

    const { leafId, path } = this._findLeaf(low);
    yield* this._describeDescent(low, path);

    let current = this._nodeById(leafId);
    while (current !== null) {
      yield {
        type: 'visit',
        message: `Visiting leaf ${current.id} while scanning the range from ${low} to ${high}.`,
        focus: [current.id],
      };
      let passedHigh = false;
      for (const key of current.keys) {
        if (key < low) continue;
        if (key > high) {
          passedHigh = true;
          break;
        }
        results.push(key);
        yield {
          type: 'found',
          message: `Key ${key} lies inside the range from ${low} to ${high}.`,
          focus: [current.id],
        };
      }
      if (passedHigh || current.next === null) break;
      current = this._nodeById(current.next);
    }

    if (results.length === 0) {
      yield {
        type: 'miss',
        message: `No keys were found in the range from ${low} to ${high}.`,
        focus: [],
      };
    } else {
      yield {
        type: 'done',
        message: `Found ${results.length} key${results.length === 1 ? '' : 's'} in the range from ${low} to ${high}.`,
        focus: [],
      };
    }
    return results;
  }

  *delete(key) {
    if (this.state.root === null) {
      yield {
        type: 'miss',
        message: `The tree is empty, so ${key} cannot be deleted.`,
        focus: [],
      };
      return null;
    }

    const { leafId, path } = this._findLeaf(key);
    yield* this._describeDescent(key, path);
    const leaf = this._nodeById(leafId);

    const position = this._sortedPosition(leaf.keys, key);
    if (position >= leaf.keys.length || leaf.keys[position] !== key) {
      yield {
        type: 'miss',
        message: `Key ${key} is not present, so nothing was deleted.`,
        focus: [leaf.id],
      };
      return null;
    }

    leaf.keys.splice(position, 1);
    this._rebuildEdges();
    yield {
      type: 'delete',
      message: `Removed key ${key} from leaf ${leaf.id}.`,
      focus: [leaf.id],
    };

    if (leaf.keys.length < this._minKeys() && path.length > 0) {
      yield* this._fixLeafUnderflow(leaf, path);
    }

    this._recomputeSeparators();
    yield {
      type: 'done',
      message: `Deletion of ${key} is complete.`,
      focus: [],
    };
    return key;
  }
}
