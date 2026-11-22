import { BaseStructure } from '../core/BaseStructure.js';

export const meta = {
  id: 'btree',
  title: 'B-Tree',
  group: 'Trees',
  layout: 'multiKey',
  description:
    'A balanced multiway search tree. Every node stores sorted keys, every internal node has one more child than it has keys, and all leaves stay at the same depth. Insertion descends to a leaf and splits overflowing nodes bottom-up on the way back to the root, while deletion borrows keys from siblings or merges them when a child would fall below the minimum. The default order is 4, which gives a minimum degree t = 2. Odd orders are rounded up to the next even order so splits and merges stay balanced. Duplicate keys are ignored and keys are treated as numbers.',
  demo: [10, 20, 5, 6, 12, 30, 7, 17],
  operations: {
    insert: {
      signature: 'insert(key)',
      label: 'Insert',
      fields: [{ name: 'key', label: 'Key', type: 'number', placeholder: 'e.g. 10' }],
      description: 'Inserts a key into a leaf, then splits overflowing nodes bottom-up back to the root.',
      best: { symbol: 'Ω(log_m n)', text: 'descent follows one root-to-leaf path, with m = order' },
      average: { symbol: 'Θ(log_m n)', text: 'descent follows one root-to-leaf path, with m = order' },
      worst: { symbol: 'O(log n)', text: 'the tree height is logarithmic in n and m = order bounds the fan-out' },
    },
    search: {
      signature: 'search(key)',
      label: 'Search',
      fields: [{ name: 'key', label: 'Key', type: 'number', placeholder: 'e.g. 10' }],
      description: 'Compares the key with the keys of each visited node until it is found or a leaf is reached.',
      best: { symbol: 'Ω(log_m n)', text: 'descent follows one root-to-leaf path, with m = order' },
      average: { symbol: 'Θ(log_m n)', text: 'descent follows one root-to-leaf path, with m = order' },
      worst: { symbol: 'O(log n)', text: 'the tree height is logarithmic in n and m = order bounds the fan-out' },
    },
    delete: {
      signature: 'delete(key)',
      label: 'Delete',
      fields: [{ name: 'key', label: 'Key', type: 'number', placeholder: 'e.g. 10' }],
      description: 'Removes a key, borrowing from siblings or merging nodes to keep every non-root node at least half full.',
      best: { symbol: 'Ω(log_m n)', text: 'descent follows one root-to-leaf path, with m = order' },
      average: { symbol: 'Θ(log_m n)', text: 'descent follows one root-to-leaf path, with m = order' },
      worst: { symbol: 'O(log n)', text: 'the tree height is logarithmic in n and m = order bounds the fan-out' },
    },
  },
};

/**
 * B-tree with maximum `order` children per node (order 4 means degree t = 2).
 * State is plain data: nodes hold sorted keys and edges carry child indices.
 */
export class BTree extends BaseStructure {
  static meta = meta;

  constructor(order = 4) {
    super(meta, { order: 4, root: null, nodes: [], edges: [] });
    const requested = Math.max(4, Math.floor(Number(order) || 4));
    this.order = requested % 2 === 0 ? requested : requested + 1;
    this.t = this.order / 2;
    this.maxKeys = this.order - 1;
    this.minKeys = this.t - 1;
    this.state = this.initialState();
  }

  initialState() {
    return { order: this.order, root: null, nodes: [], edges: [] };
  }

  seed(values = []) {
    for (const value of values) this._runInsert(value);
    return this;
  }

  /* ------------------------------------------------------------------ *
   * Small state helpers (no yields, no DOM).
   * ------------------------------------------------------------------ */

  _runInsert(key) {
    const iterator = this.insert(key);
    let result = iterator.next();
    while (!result.done) result = iterator.next();
    return result.value;
  }

  _node(id) {
    return this.state.nodes.find((node) => node.id === id);
  }

  _children(id) {
    return this.state.edges
      .filter((edge) => edge.from === id)
      .sort((a, b) => a.index - b.index)
      .map((edge) => edge.to);
  }

  _setChildren(id, childIds) {
    this.state.edges = this.state.edges.filter((edge) => edge.from !== id);
    childIds.forEach((to, index) => this.state.edges.push({ from: id, to, index }));
  }

  _insertChild(fromId, index, toId) {
    for (const edge of this.state.edges) {
      if (edge.from === fromId && edge.index >= index) edge.index += 1;
    }
    this.state.edges.push({ from: fromId, to: toId, index });
  }

  _removeChildAt(fromId, index) {
    this.state.edges = this.state.edges.filter(
      (edge) => !(edge.from === fromId && edge.index === index),
    );
    for (const edge of this.state.edges) {
      if (edge.from === fromId && edge.index > index) edge.index -= 1;
    }
  }

  _addNode(keys = [], leaf = true) {
    const id = this._createId('b');
    this.state.nodes.push({ id, keys: [...keys], leaf });
    return id;
  }

  _deleteNode(id) {
    this.state.nodes = this.state.nodes.filter((node) => node.id !== id);
    this.state.edges = this.state.edges.filter(
      (edge) => edge.from !== id && edge.to !== id,
    );
  }

  _lowerBound(node, key) {
    let index = 0;
    while (index < node.keys.length && key > node.keys[index]) index += 1;
    return index;
  }

  _minKey(nodeId) {
    let node = this._node(nodeId);
    while (!node.leaf) node = this._node(this._children(node.id)[0]);
    return node.keys[0];
  }

  _maxKey(nodeId) {
    let node = this._node(nodeId);
    while (!node.leaf) node = this._node(this._children(node.id).at(-1));
    return node.keys.at(-1);
  }

  _splitRootNode() {
    const oldId = this.state.root;
    const old = this._node(oldId);
    const medianIndex = Math.floor(old.keys.length / 2);
    const median = old.keys[medianIndex];
    const children = old.leaf ? [] : this._children(oldId);
    const rightId = this._addNode(old.keys.slice(medianIndex + 1), old.leaf);
    old.keys = old.keys.slice(0, medianIndex);
    const newRootId = this._addNode([median], false);
    this._setChildren(oldId, children.slice(0, medianIndex + 1));
    this._setChildren(rightId, children.slice(medianIndex + 1));
    this._setChildren(newRootId, [oldId, rightId]);
    this.state.root = newRootId;
    return { leftId: oldId, rightId, newRootId, median };
  }

  _splitChildNode(parentId, index) {
    const childId = this._children(parentId)[index];
    const child = this._node(childId);
    const medianIndex = Math.floor(child.keys.length / 2);
    const median = child.keys[medianIndex];
    const children = child.leaf ? [] : this._children(childId);
    const rightId = this._addNode(child.keys.slice(medianIndex + 1), child.leaf);
    child.keys = child.keys.slice(0, medianIndex);
    this._setChildren(childId, children.slice(0, medianIndex + 1));
    this._setChildren(rightId, children.slice(medianIndex + 1));
    this._node(parentId).keys.splice(index, 0, median);
    this._insertChild(parentId, index + 1, rightId);
    return { childId, rightId, median, index };
  }

  /* ------------------------------------------------------------------ *
   * Public operations.
   * ------------------------------------------------------------------ */

  *insert(key) {
    const value = Number(key);
    if (!Number.isFinite(value)) {
      yield { type: 'miss', message: `Key ${key} is not a finite number and cannot be inserted.`, focus: [] };
      return null;
    }

    if (this.state.root === null) {
      const id = this._addNode([value], true);
      this.state.root = id;
      yield { type: 'visit', message: `Created the empty root node ${id}.`, focus: [id] };
      yield { type: 'insert', message: `Inserted key ${value} into the new root ${id}.`, focus: [id] };
      yield { type: 'done', message: `Key ${value} is now stored in the B-tree.`, focus: [id] };
      return value;
    }

    yield {
      type: 'visit',
      message: `Starting insertion of key ${value} at root ${this.state.root}.`,
      focus: [this.state.root],
    };

    const path = [];
    let nodeId = this.state.root;
    while (true) {
      const node = this._node(nodeId);
      if (node.leaf) break;

      const index = this._lowerBound(node, value);
      if (index < node.keys.length && node.keys[index] === value) {
        yield {
          type: 'compare',
          message: `Key ${value} matches the separator at index ${index} of node ${nodeId}.`,
          focus: [nodeId],
        };
        yield {
          type: 'miss',
          message: `Key ${value} was not inserted because duplicate keys are ignored.`,
          focus: [nodeId],
        };
        return null;
      }
      yield {
        type: 'compare',
        message: `Key ${value} belongs to child ${index} of node ${nodeId}.`,
        focus: [nodeId],
      };
      path.push({ id: nodeId, index });
      nodeId = this._children(nodeId)[index];
      yield {
        type: 'visit',
        message: `Descending into node ${nodeId}.`,
        focus: [nodeId],
      };
    }

    const leaf = this._node(nodeId);
    const position = this._lowerBound(leaf, value);
    if (position < leaf.keys.length && leaf.keys[position] === value) {
      yield {
        type: 'miss',
        message: `Key ${value} was not inserted because duplicate keys are ignored.`,
        focus: [nodeId],
      };
      return null;
    }
    leaf.keys.splice(position, 0, value);
    yield {
      type: 'insert',
      message: `Inserted key ${value} into leaf ${nodeId} at index ${position}.`,
      focus: [nodeId],
    };

    let currentId = nodeId;
    while (this._node(currentId).keys.length > this.maxKeys) {
      if (currentId === this.state.root) {
        const split = this._splitRootNode();
        yield {
          type: 'split',
          message: `Split overflowing root ${split.leftId}; key ${split.median} moved up to new root ${split.newRootId}.`,
          focus: [split.leftId, split.rightId, split.newRootId],
        };
        break;
      }
      const entry = path.at(-1);
      const split = this._splitChildNode(entry.id, entry.index);
      yield {
        type: 'split',
        message: `Split overflowing child ${split.childId}; key ${split.median} moved up into parent ${entry.id}.`,
        focus: [split.childId, split.rightId, entry.id],
      };
      path.pop();
      currentId = entry.id;
    }

    yield {
      type: 'done',
      message: `Key ${value} is now stored in the B-tree.`,
      focus: [],
    };
    return value;
  }

  *search(key) {
    const value = Number(key);
    if (this.state.root === null || !Number.isFinite(value)) {
      yield {
        type: 'miss',
        message: `Key ${key} is not present in the B-tree.`,
        focus: [],
      };
      return false;
    }

    let nodeId = this.state.root;
    while (true) {
      const node = this._node(nodeId);
      yield {
        type: 'visit',
        message: `Visiting node ${nodeId} while searching for key ${value}.`,
        focus: [nodeId],
      };
      let index = 0;
      while (index < node.keys.length && value > node.keys[index]) {
        yield {
          type: 'compare',
          message: `Key ${value} is greater than key ${node.keys[index]} in node ${nodeId}.`,
          focus: [nodeId],
        };
        index += 1;
      }
      if (index < node.keys.length) {
        yield {
          type: 'compare',
          message: `Comparing key ${value} with key ${node.keys[index]} in node ${nodeId}.`,
          focus: [nodeId],
        };
        if (value === node.keys[index]) {
          yield {
            type: 'found',
            message: `Found key ${value} in node ${nodeId} at index ${index}.`,
            focus: [nodeId],
          };
          return true;
        }
      }
      if (node.leaf) {
        yield {
          type: 'miss',
          message: `Key ${value} is not present in the B-tree.`,
          focus: [nodeId],
        };
        return false;
      }
      nodeId = this._children(nodeId)[index];
    }
  }

  *delete(key) {
    const value = Number(key);
    if (this.state.root === null || !Number.isFinite(value)) {
      yield {
        type: 'miss',
        message: `Key ${key} cannot be deleted because it is not stored in the B-tree.`,
        focus: [],
      };
      return false;
    }

    yield {
      type: 'visit',
      message: `Starting deletion of key ${value} at root ${this.state.root}.`,
      focus: [this.state.root],
    };
    const deleted = yield* this._remove(this.state.root, value);
    yield* this._collapseRoot();

    if (deleted) {
      yield {
        type: 'done',
        message: `Key ${value} has been removed from the B-tree.`,
        focus: [],
      };
    } else {
      yield {
        type: 'miss',
        message: `Key ${value} was not found, so nothing was removed.`,
        focus: [],
      };
    }
    return deleted;
  }

  /* ------------------------------------------------------------------ *
   * Deletion internals.
   * ------------------------------------------------------------------ */

  *borrowFromLeft(parentId, index) {
    const children = this._children(parentId);
    const childId = children[index];
    const siblingId = children[index - 1];
    const parent = this._node(parentId);
    const child = this._node(childId);
    const sibling = this._node(siblingId);
    const separator = parent.keys[index - 1];
    const borrowed = sibling.keys.pop();
    parent.keys[index - 1] = borrowed;
    child.keys.unshift(separator);
    if (!child.leaf) {
      const movedId = this._children(siblingId).at(-1);
      this._removeChildAt(siblingId, this._children(siblingId).length - 1);
      this._insertChild(childId, 0, movedId);
    }
    yield {
      type: 'borrow',
      message: `Borrowed key ${borrowed} from left sibling ${siblingId} into node ${childId}.`,
      focus: [siblingId, childId, parentId],
    };
  }

  *borrowFromRight(parentId, index) {
    const children = this._children(parentId);
    const childId = children[index];
    const siblingId = children[index + 1];
    const parent = this._node(parentId);
    const child = this._node(childId);
    const sibling = this._node(siblingId);
    const separator = parent.keys[index];
    const borrowed = sibling.keys.shift();
    parent.keys[index] = borrowed;
    child.keys.push(separator);
    if (!child.leaf) {
      const movedId = this._children(siblingId)[0];
      this._removeChildAt(siblingId, 0);
      this._insertChild(childId, this._children(childId).length, movedId);
    }
    yield {
      type: 'borrow',
      message: `Borrowed key ${borrowed} from right sibling ${siblingId} into node ${childId}.`,
      focus: [siblingId, childId, parentId],
    };
  }

  *_mergeChildren(parentId, leftIndex) {
    const parent = this._node(parentId);
    const leftId = this._children(parentId)[leftIndex];
    const rightId = this._children(parentId)[leftIndex + 1];
    const left = this._node(leftId);
    const right = this._node(rightId);
    const separator = parent.keys[leftIndex];
    left.keys.push(separator, ...right.keys);
    if (!left.leaf) {
      this._setChildren(leftId, [...this._children(leftId), ...this._children(rightId)]);
    }
    parent.keys.splice(leftIndex, 1);
    this._removeChildAt(parentId, leftIndex + 1);
    this._deleteNode(rightId);
    yield {
      type: 'merge',
      message: `Merged node ${rightId} into node ${leftId} using separator key ${separator}.`,
      focus: [leftId, parentId],
    };
  }

  *_fill(parentId, index) {
    const children = this._children(parentId);
    if (index > 0 && this._node(children[index - 1]).keys.length >= this.t) {
      yield* this.borrowFromLeft(parentId, index);
      return;
    }
    if (index + 1 < children.length && this._node(children[index + 1]).keys.length >= this.t) {
      yield* this.borrowFromRight(parentId, index);
      return;
    }
    if (index + 1 < children.length) {
      yield* this._mergeChildren(parentId, index);
    } else {
      yield* this._mergeChildren(parentId, index - 1);
    }
  }

  *_remove(nodeId, key) {
    const node = this._node(nodeId);
    const index = this._lowerBound(node, key);
    const found = index < node.keys.length && node.keys[index] === key;

    if (found && node.leaf) {
      node.keys.splice(index, 1);
      yield {
        type: 'delete',
        message: `Removed key ${key} from leaf ${nodeId}.`,
        focus: [nodeId],
      };
      return true;
    }

    if (found && !node.leaf) {
      yield {
        type: 'visit',
        message: `Key ${key} is stored in internal node ${nodeId}.`,
        focus: [nodeId],
      };
      const leftId = this._children(nodeId)[index];
      const rightId = this._children(nodeId)[index + 1];
      if (this._node(leftId).keys.length >= this.t) {
        const predecessor = this._maxKey(leftId);
        node.keys[index] = predecessor;
        yield {
          type: 'access',
          message: `Replaced key ${key} with predecessor ${predecessor} in node ${nodeId}.`,
          focus: [nodeId, leftId],
        };
        return yield* this._remove(leftId, predecessor);
      }
      if (this._node(rightId).keys.length >= this.t) {
        const successor = this._minKey(rightId);
        node.keys[index] = successor;
        yield {
          type: 'access',
          message: `Replaced key ${key} with successor ${successor} in node ${nodeId}.`,
          focus: [nodeId, rightId],
        };
        return yield* this._remove(rightId, successor);
      }
      yield* this._mergeChildren(nodeId, index);
      return yield* this._remove(this._children(nodeId)[index], key);
    }

    if (node.leaf) {
      yield {
        type: 'miss',
        message: `Key ${key} is not present in node ${nodeId}.`,
        focus: [nodeId],
      };
      return false;
    }

    let childIndex = index;
    const wasLastChild = index === node.keys.length;
    const childId = this._children(nodeId)[childIndex];
    if (this._node(childId).keys.length <= this.minKeys) {
      yield* this._fill(nodeId, childIndex);
      if (wasLastChild && childIndex > this._node(nodeId).keys.length) childIndex -= 1;
    }
    const nextId = this._children(nodeId)[childIndex];
    yield {
      type: 'visit',
      message: `Descending into child ${childIndex} of node ${nodeId}.`,
      focus: [nextId],
    };
    return yield* this._remove(nextId, key);
  }

  *_collapseRoot() {
    const rootId = this.state.root;
    if (rootId === null) return;
    const root = this._node(rootId);
    if (root.keys.length === 0 && !root.leaf) {
      const childId = this._children(rootId)[0];
      this.state.root = childId;
      this._deleteNode(rootId);
      yield {
        type: 'merge',
        message: `Empty root ${rootId} was removed and child ${childId} became the new root.`,
        focus: [childId],
      };
    } else if (root.keys.length === 0 && root.leaf) {
      this._deleteNode(rootId);
      this.state.root = null;
      yield {
        type: 'delete',
        message: 'The B-tree is empty after removing its last key.',
        focus: [],
      };
    }
  }
}
