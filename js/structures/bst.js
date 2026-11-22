import { BaseStructure } from '../core/BaseStructure.js';

export const meta = {
  id: 'bst',
  title: 'Binary Search Tree',
  group: 'Trees',
  layout: 'tree',
  description: 'A binary tree that keeps every value in a left subtree smaller than its node and every value in a right subtree larger. Operations start at the root and descend by comparing the target with the current value. Duplicate values are ignored so the tree behaves like a sorted set.',
  demo: [50, 30, 70, 20, 40, 60, 80],
  operations: {
    insert: {
      signature: 'insert(value)',
      label: 'Insert',
      fields: [{ name: 'value', label: 'Value', type: 'number', placeholder: 'e.g. 42' }],
      description: 'Compares the value with each node from the root downward and attaches it as the first empty left or right child. Values already present are ignored.',
      best: { symbol: 'Ω(1)', text: 'the tree is empty, so the value becomes the root' },
      average: { symbol: 'Θ(log n)', text: 'descend a balanced tree by about log n comparisons' },
      worst: { symbol: 'O(n)', text: 'a degenerate tree requires walking every node' },
    },
    search: {
      signature: 'search(value)',
      label: 'Search',
      fields: [{ name: 'value', label: 'Value', type: 'number', placeholder: 'e.g. 42' }],
      description: 'Compares the value with each node from the root and follows the left or right branch until the value is found or an empty branch is reached.',
      best: { symbol: 'Ω(1)', text: 'the value is stored at the root' },
      average: { symbol: 'Θ(log n)', text: 'about log n comparisons in a balanced tree' },
      worst: { symbol: 'O(n)', text: 'the value is absent in a degenerate tree' },
    },
    delete: {
      signature: 'delete(value)',
      label: 'Delete',
      fields: [{ name: 'value', label: 'Value', type: 'number', placeholder: 'e.g. 42' }],
      description: 'Finds the value, then removes a leaf directly, replaces a node with its only child, or uses the in-order successor when the node has two children.',
      best: { symbol: 'Ω(1)', text: 'the target is the root with no child to relink' },
      average: { symbol: 'Θ(log n)', text: 'descend a balanced tree and relink the target' },
      worst: { symbol: 'O(n)', text: 'a degenerate tree requires walking every node' },
    },
    inorder: {
      signature: 'inorder()',
      label: 'In-order',
      description: 'Visits the left subtree, then the node, then the right subtree, which yields the stored values in sorted ascending order.',
      best: { symbol: 'Ω(n)', text: 'every node must be visited at least once' },
      average: { symbol: 'Θ(n)', text: 'one visit per node' },
      worst: { symbol: 'O(n)', text: 'one visit per node' },
    },
    preorder: {
      signature: 'preorder()',
      label: 'Pre-order',
      description: 'Visits the node before its left subtree and then its right subtree, which is useful for copying the tree.',
      best: { symbol: 'Ω(n)', text: 'every node must be visited at least once' },
      average: { symbol: 'Θ(n)', text: 'one visit per node' },
      worst: { symbol: 'O(n)', text: 'one visit per node' },
    },
    postorder: {
      signature: 'postorder()',
      label: 'Post-order',
      description: 'Visits the left subtree, then the right subtree, and finally the node, which is useful for deleting a tree bottom up.',
      best: { symbol: 'Ω(n)', text: 'every node must be visited at least once' },
      average: { symbol: 'Θ(n)', text: 'one visit per node' },
      worst: { symbol: 'O(n)', text: 'one visit per node' },
    },
  },
};

export class BinarySearchTree extends BaseStructure {
  static meta = meta;

  constructor() {
    super(meta, {
      root: null,
      nodes: [],
      edges: [],
    });
  }

  initialState() {
    return { root: null, nodes: [], edges: [] };
  }

  seed(values = []) {
    for (const value of values) {
      // Draining the insert generator keeps seeding and the public operation
      // on exactly the same code path, including duplicate handling.
      for (const _step of this.insert(value)) { /* steps are ignored while seeding */ }
    }
    return this;
  }

  _nodeById(id) {
    if (id === null || id === undefined) return null;
    return this.state.nodes.find((node) => node.id === id) ?? null;
  }

  _child(id, side) {
    if (id === null || id === undefined) return null;
    const edge = this.state.edges.find((item) => item.from === id && item.side === side);
    return edge ? edge.to : null;
  }

  _makeNode(value) {
    const node = { id: this._createId('n'), value };
    this.state.nodes.push(node);
    return node;
  }

  *_insertNode(value, message) {
    const node = this._makeNode(value);
    this.state.root = node.id;
    yield {
      type: 'insert',
      message,
      focus: [node.id],
    };
    yield {
      type: 'done',
      message: `${value} is now stored in the tree.`,
      focus: [node.id],
    };
    return node.id;
  }

  *insert(value) {
    if (this.state.root === null) {
      return yield* this._insertNode(value, `Inserted ${value} as the root of the empty tree.`);
    }

    let currentId = this.state.root;
    while (currentId !== null) {
      const current = this._nodeById(currentId);
      yield {
        type: 'compare',
        message: `Comparing ${value} with ${current.value} while looking for an insertion point.`,
        focus: [current.id],
      };
      if (value === current.value) {
        yield {
          type: 'miss',
          message: `${value} is already in the tree, so no duplicate was inserted.`,
          focus: [current.id],
        };
        return null;
      }
      const side = value < current.value ? 'left' : 'right';
      const nextId = this._child(currentId, side);
      if (nextId === null) {
        const node = this._makeNode(value);
        this.state.edges.push({ from: currentId, to: node.id, side });
        yield {
          type: 'insert',
          message: `Inserted ${value} as the ${side} child of ${current.value}.`,
          focus: [node.id, current.id],
        };
        yield {
          type: 'done',
          message: `${value} is now stored in the tree.`,
          focus: [node.id],
        };
        return node.id;
      }
      currentId = nextId;
    }
    return null;
  }

  *search(value) {
    let currentId = this.state.root;
    while (currentId !== null) {
      const current = this._nodeById(currentId);
      yield {
        type: 'compare',
        message: `Comparing ${value} with ${current.value} while searching the tree.`,
        focus: [current.id],
      };
      if (value === current.value) {
        yield {
          type: 'found',
          message: `Found ${value} in the tree.`,
          focus: [current.id],
        };
        return current.id;
      }
      currentId = this._child(currentId, value < current.value ? 'left' : 'right');
    }
    yield {
      type: 'miss',
      message: `${value} is not present in the tree.`,
      focus: [],
    };
    return null;
  }

  *delete(value) {
    let parentId = null;
    let parentSide = null;
    let currentId = this.state.root;

    while (currentId !== null) {
      const current = this._nodeById(currentId);
      yield {
        type: 'compare',
        message: `Comparing ${value} with ${current.value} while searching for the node to delete.`,
        focus: [current.id],
      };
      if (value === current.value) break;
      parentId = currentId;
      parentSide = value < current.value ? 'left' : 'right';
      currentId = this._child(currentId, parentSide);
    }

    if (currentId === null) {
      yield {
        type: 'miss',
        message: `${value} was not found, so no node was removed.`,
        focus: [],
      };
      return null;
    }

    let targetId = currentId;
    let target = this._nodeById(targetId);
    let targetParentId = parentId;
    let targetParentSide = parentSide;

    const leftId = this._child(targetId, 'left');
    const rightId = this._child(targetId, 'right');

    if (leftId !== null && rightId !== null) {
      let successorParentId = targetId;
      let successorParentSide = 'right';
      let successorId = rightId;
      while (true) {
        const successor = this._nodeById(successorId);
        yield {
          type: 'visit',
          message: `Looking for the in-order successor of ${target.value} at node ${successor.value}.`,
          focus: [successor.id],
        };
        const nextId = this._child(successorId, 'left');
        if (nextId === null) break;
        successorParentId = successorId;
        successorParentSide = 'left';
        successorId = nextId;
      }
      const successor = this._nodeById(successorId);
      yield {
        type: 'visit',
        message: `Found ${successor.value} as the in-order successor of ${target.value}.`,
        focus: [successor.id, target.id],
      };
      target.value = successor.value;
      yield {
        type: 'visit',
        message: `Copied the successor value ${successor.value} into the node that will be removed.`,
        focus: [target.id],
      };
      targetId = successorId;
      target = successor;
      targetParentId = successorParentId;
      targetParentSide = successorParentSide;
    }

    const childId = this._child(targetId, 'left') ?? this._child(targetId, 'right');
    if (childId !== null) {
      const child = this._nodeById(childId);
      if (targetParentId === null) {
        this.state.root = childId;
      } else {
        const edge = this.state.edges.find(
          (item) => item.from === targetParentId && item.side === targetParentSide,
        );
        if (edge) edge.to = childId;
      }
      this.state.edges = this.state.edges.filter((item) => item.from !== targetId);
      yield {
        type: 'visit',
        message: `Connected the child ${child.value} in place of ${target.value}.`,
        focus: [child.id, target.id],
      };
    } else {
      if (targetParentId === null) {
        this.state.root = null;
      } else {
        this.state.edges = this.state.edges.filter(
          (item) => !(item.from === targetParentId && item.side === targetParentSide),
        );
      }
      yield {
        type: 'visit',
        message: `Removed the leaf node ${target.value}.`,
        focus: [target.id],
      };
    }

    this.state.edges = this.state.edges.filter(
      (item) => item.from !== targetId && item.to !== targetId,
    );
    this.state.nodes = this.state.nodes.filter((node) => node.id !== targetId);

    const anchorId = targetParentId ?? this.state.root;
    yield {
      type: 'delete',
      message: `Removed ${value} from the tree.`,
      focus: anchorId ? [anchorId] : [],
    };
    yield {
      type: 'done',
      message: this.state.root === null
        ? 'The tree is now empty.'
        : `The tree now contains ${this.state.nodes.length} node${this.state.nodes.length === 1 ? '' : 's'}.`,
      focus: anchorId ? [anchorId] : [],
    };
    return value;
  }

  *_walk(id, order, values) {
    if (id === null || id === undefined) return;
    const node = this._nodeById(id);
    const leftId = this._child(id, 'left');
    const rightId = this._child(id, 'right');
    if (order === 'preorder') {
      yield* this._visitNode(node, values);
      yield* this._walk(leftId, order, values);
      yield* this._walk(rightId, order, values);
    } else if (order === 'postorder') {
      yield* this._walk(leftId, order, values);
      yield* this._walk(rightId, order, values);
      yield* this._visitNode(node, values);
    } else {
      yield* this._walk(leftId, order, values);
      yield* this._visitNode(node, values);
      yield* this._walk(rightId, order, values);
    }
  }

  *_visitNode(node, values) {
    values.push(node.value);
    yield {
      type: 'visit',
      message: `Visiting ${node.value} during the traversal.`,
      focus: [node.id],
      payload: { value: node.value },
    };
  }

  *_traverse(order, label) {
    const values = [];
    yield* this._walk(this.state.root, order, values);
    yield {
      type: 'done',
      message: `Finished the ${label} traversal.`,
      focus: [],
    };
    return values;
  }

  *inorder() {
    return yield* this._traverse('inorder', 'in-order');
  }

  *preorder() {
    return yield* this._traverse('preorder', 'pre-order');
  }

  *postorder() {
    return yield* this._traverse('postorder', 'post-order');
  }
}
