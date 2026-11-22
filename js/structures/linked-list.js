import { BaseStructure } from '../core/BaseStructure.js';

export const meta = {
  id: 'linked-list',
  title: 'Linked List',
  group: 'Linear',
  layout: 'linear',
  description: 'A linear collection of nodes where each node stores a value and a pointer to the next node. The list keeps a head and a tail pointer, so both ends can be updated directly while interior access follows the pointer chain.',
  demo: [4, 8, 15],
  operations: {
    insertHead: {
      signature: 'insertHead(value)',
      label: 'Insert at head',
      fields: [{ name: 'value', label: 'Value', type: 'number', placeholder: 'e.g. 42' }],
      description: 'Adds a new node before the current head and makes it the new head.',
      best: { symbol: 'Ω(1)', text: 'only the head pointer is updated' },
      average: { symbol: 'Θ(1)', text: 'constant time' },
      worst: { symbol: 'O(1)', text: 'constant time' },
    },
    insertTail: {
      signature: 'insertTail(value)',
      label: 'Insert at tail',
      fields: [{ name: 'value', label: 'Value', type: 'number', placeholder: 'e.g. 42' }],
      description: 'Adds a new node after the current tail and makes it the new tail.',
      best: { symbol: 'Ω(1)', text: 'the tail pointer is already known' },
      average: { symbol: 'Θ(1)', text: 'constant time' },
      worst: { symbol: 'O(1)', text: 'constant time' },
    },
    insertAt: {
      signature: 'insertAt(index, value)',
      label: 'Insert at index',
      fields: [
        { name: 'index', label: 'Index', type: 'number', placeholder: 'e.g. 1' },
        { name: 'value', label: 'Value', type: 'number', placeholder: 'e.g. 42' },
      ],
      description: 'Inserts a new node at a zero-based index, after walking from the head to that position. An index equal to the length appends to the tail, while a negative index or an index past the end is rejected.',
      best: { symbol: 'Ω(1)', text: 'inserting at index zero needs no traversal' },
      average: { symbol: 'Θ(n)', text: 'walk to the requested index' },
      worst: { symbol: 'O(n)', text: 'walk to the last position' },
    },
    delete: {
      signature: 'delete(value)',
      label: 'Delete',
      fields: [{ name: 'value', label: 'Value', type: 'number', placeholder: 'e.g. 42' }],
      description: 'Removes the first node whose value matches the requested value and reconnects its neighbors.',
      best: { symbol: 'Ω(1)', text: 'the matching node is the head' },
      average: { symbol: 'Θ(n)', text: 'walk to the first match' },
      worst: { symbol: 'O(n)', text: 'the value is absent or the match is the tail' },
    },
    search: {
      signature: 'search(value)',
      label: 'Search',
      fields: [{ name: 'value', label: 'Value', type: 'number', placeholder: 'e.g. 42' }],
      description: 'Follows next pointers from the head until the value is found or the end of the list is reached.',
      best: { symbol: 'Ω(1)', text: 'the value is stored in the head' },
      average: { symbol: 'Θ(n)', text: 'inspect about half of the nodes' },
      worst: { symbol: 'O(n)', text: 'the value is absent or stored in the tail' },
    },
    reverse: {
      signature: 'reverse()',
      label: 'Reverse',
      description: 'Flips every next pointer so the tail becomes the head and the head becomes the tail.',
      best: { symbol: 'Ω(n)', text: 'every node pointer must be flipped' },
      average: { symbol: 'Θ(n)', text: 'one pass over all nodes' },
      worst: { symbol: 'O(n)', text: 'one pass over all nodes' },
    },
  },
};

export class LinkedList extends BaseStructure {
  static meta = meta;

  constructor() {
    super(meta, {
      nodes: [],
      edges: [],
      head: null,
      tail: null,
      headLabel: 'HEAD',
      tailLabel: 'TAIL',
      orientation: 'horizontal',
    });
  }

  initialState() {
    return {
      nodes: [],
      edges: [],
      head: null,
      tail: null,
      headLabel: 'HEAD',
      tailLabel: 'TAIL',
      orientation: 'horizontal',
    };
  }

  seed(values = []) {
    for (const value of values) this._appendNode(value);
    return this;
  }

  _nodeById(id) {
    if (id === null || id === undefined) return null;
    return this.state.nodes.find((node) => node.id === id) ?? null;
  }

  _rebuildEdges() {
    this.state.edges = this.state.nodes
      .filter((node) => node.next !== null && node.next !== undefined)
      .map((node) => ({ from: node.id, to: node.next, directed: true }));
    return this.state.edges;
  }

  _appendNode(value) {
    const node = { id: this._createId('node'), value, next: null };
    const previousTail = this._nodeById(this.state.tail);
    this.state.nodes.push(node);
    if (previousTail) {
      previousTail.next = node.id;
    } else {
      this.state.head = node.id;
    }
    this.state.tail = node.id;
    this._rebuildEdges();
    return node;
  }

  *_insertNode(node, index, message) {
    this.state.nodes.splice(index, 0, node);
    this._rebuildEdges();
    yield {
      type: 'insert',
      message,
      focus: [node.id],
    };
    yield {
      type: 'done',
      message: `The list now contains ${this.state.nodes.length} node${this.state.nodes.length === 1 ? '' : 's'}.`,
      focus: [node.id],
    };
    return node.id;
  }

  *insertHead(value) {
    const wasEmpty = this.state.nodes.length === 0;
    const oldHead = this._nodeById(this.state.head);
    const node = { id: this._createId('node'), value, next: this.state.head };
    this.state.head = node.id;
    if (wasEmpty) this.state.tail = node.id;
    return yield* this._insertNode(
      node,
      0,
      wasEmpty
        ? `Inserted ${value} as the only node of the empty list.`
        : `Inserted ${value} at the head before ${oldHead.value}.`,
    );
  }

  *insertTail(value) {
    const previousTail = this._nodeById(this.state.tail);
    const node = { id: this._createId('node'), value, next: null };
    if (previousTail) {
      previousTail.next = node.id;
    } else {
      this.state.head = node.id;
    }
    this.state.tail = node.id;
    return yield* this._insertNode(
      node,
      this.state.nodes.length,
      previousTail
        ? `Inserted ${value} at the tail after ${previousTail.value}.`
        : `Inserted ${value} as the only node of the empty list.`,
    );
  }

  *insertAt(index, value) {
    const length = this.state.nodes.length;
    if (!Number.isInteger(index) || index < 0 || index > length) {
      yield {
        type: 'miss',
        message: `Index ${index} is out of range for a list of length ${length}, so nothing was inserted.`,
        focus: [],
      };
      return null;
    }
    if (index === 0) return yield* this.insertHead(value);
    if (index === length) return yield* this.insertTail(value);

    let currentId = this.state.head;
    for (let i = 0; i < index - 1; i += 1) {
      const current = this._nodeById(currentId);
      yield {
        type: 'visit',
        message: `Visiting node ${current.value} at index ${i} while walking to index ${index}.`,
        focus: [current.id],
      };
      currentId = current.next;
    }

    const previous = this._nodeById(currentId);
    const node = { id: this._createId('node'), value, next: previous.next };
    previous.next = node.id;
    return yield* this._insertNode(
      node,
      index,
      `Inserted ${value} at index ${index} between ${previous.value} and ${node.next ? this._nodeById(node.next).value : 'the end of the list'}.`,
    );
  }

  *delete(value) {
    let previousId = null;
    let currentId = this.state.head;
    let index = 0;

    while (currentId !== null) {
      const current = this._nodeById(currentId);
      yield {
        type: 'visit',
        message: `Visiting node ${current.value} at index ${index} while looking for ${value}.`,
        focus: [current.id],
      };
      if (current.value === value) {
        const nextId = current.next;
        if (previousId === null) {
          this.state.head = nextId;
        } else {
          this._nodeById(previousId).next = nextId;
        }
        if (this.state.tail === current.id) {
          this.state.tail = previousId;
        }
        this.state.nodes.splice(index, 1);
        this._rebuildEdges();
        const focus = this._nodeById(previousId)?.id ?? this._nodeById(this.state.head)?.id ?? null;
        yield {
          type: 'delete',
          message: `Removed the first node with value ${value} from the list.`,
          focus: focus ? [focus] : [],
        };
        yield {
          type: 'done',
          message: this.state.nodes.length === 0
            ? 'The list is now empty.'
            : `The list now has ${this.state.nodes.length} node${this.state.nodes.length === 1 ? '' : 's'}.`,
          focus: focus ? [focus] : [],
        };
        return current.id;
      }
      previousId = current.id;
      currentId = current.next;
      index += 1;
    }

    yield {
      type: 'miss',
      message: `Value ${value} was not found, so no node was removed.`,
      focus: [],
    };
    return null;
  }

  *search(value) {
    let currentId = this.state.head;
    let index = 0;

    while (currentId !== null) {
      const current = this._nodeById(currentId);
      yield {
        type: 'visit',
        message: `Visiting node ${current.value} at index ${index} while searching for ${value}.`,
        focus: [current.id],
      };
      if (current.value === value) {
        yield {
          type: 'found',
          message: `Found value ${value} at index ${index}.`,
          focus: [current.id],
        };
        return current.id;
      }
      currentId = current.next;
      index += 1;
    }

    yield {
      type: 'miss',
      message: `Value ${value} is not present in the list.`,
      focus: [],
    };
    return null;
  }

  *reverse() {
    if (this.state.nodes.length === 0) {
      yield {
        type: 'done',
        message: 'The empty list is already reversed.',
        focus: [],
      };
      return this.state.head;
    }

    const oldHead = this.state.head;
    let previousId = null;
    let currentId = this.state.head;

    while (currentId !== null) {
      const current = this._nodeById(currentId);
      const nextId = current.next;
      current.next = previousId;
      this._rebuildEdges();
      yield {
        type: 'visit',
        message: `Pointed the next pointer of ${current.value} toward ${previousId ? this._nodeById(previousId).value : 'null'}.`,
        focus: [current.id],
      };
      previousId = current.id;
      currentId = nextId;
    }

    this.state.nodes.reverse();
    this.state.head = previousId;
    this.state.tail = oldHead;
    this._rebuildEdges();
    yield {
      type: 'done',
      message: `Reversed the list: ${this._nodeById(this.state.head).value} is now the head and ${this._nodeById(this.state.tail).value} is now the tail.`,
      focus: [this.state.head, this.state.tail],
    };
    return this.state.head;
  }
}
