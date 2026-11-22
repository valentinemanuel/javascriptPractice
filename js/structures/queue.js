import { BaseStructure } from '../core/BaseStructure.js';

export const meta = {
  id: 'queue',
  title: 'Queue',
  group: 'Linear',
  layout: 'linear',
  description: 'A first-in, first-out (FIFO) collection. New values join the BACK; dequeue always removes the value at the FRONT, which is the one that has been waiting longest — not the value you just entered.',
  demo: [3, 7, 12],
  operations: {
    enqueue: {
      signature: 'enqueue(value)',
      label: 'Enqueue',
      fields: [{ name: 'value', label: 'Value', type: 'number' }],
      description: 'Adds an element to the back of the queue.',
      best: { symbol: 'Ω(1)', text: 'append at the tail' },
      average: { symbol: 'Θ(1)', text: 'constant time' },
      worst: { symbol: 'O(1)', text: 'constant time with linked nodes' },
    },
    dequeue: {
      signature: 'dequeue()',
      label: 'Dequeue',
      description: 'Removes and returns the element at the front of the queue.',
      best: { symbol: 'Ω(1)', text: 'remove at the head' },
      average: { symbol: 'Θ(1)', text: 'constant time' },
      worst: { symbol: 'O(1)', text: 'constant time by moving the head pointer' },
    },
    peek: {
      signature: 'peek()',
      label: 'Peek',
      description: 'Returns the element at the front without removing it.',
      best: { symbol: 'Ω(1)', text: 'direct head access' },
      average: { symbol: 'Θ(1)', text: 'constant time' },
      worst: { symbol: 'O(1)', text: 'constant time' },
    },
    isEmpty: {
      signature: 'isEmpty()',
      label: 'Is empty',
      description: 'Reports whether the queue contains no elements.',
      best: { symbol: 'Ω(1)', text: 'head pointer check' },
      average: { symbol: 'Θ(1)', text: 'constant time' },
      worst: { symbol: 'O(1)', text: 'constant time' },
    },
  },
};

export class Queue extends BaseStructure {
  static meta = meta;

  constructor() {
    super(meta, {
      items: [],
      head: null,
      tail: null,
      headLabel: 'FRONT',
      tailLabel: 'BACK',
      orientation: 'horizontal',
    });
    this._front = null;
    this._back = null;
  }

  initialState() {
    return {
      items: [],
      head: null,
      tail: null,
      headLabel: 'FRONT',
      tailLabel: 'BACK',
      orientation: 'horizontal',
    };
  }

  seed(values = []) {
    this._front = null;
    this._back = null;
    for (const value of values) this._enqueueNode(value);
    this._syncState();
    return this;
  }

  _enqueueNode(value) {
    const node = { id: this._createId('item'), value, next: null };
    if (this._back) {
      this._back.next = node;
    } else {
      this._front = node;
    }
    this._back = node;
    return node;
  }

  _syncState() {
    const items = [];
    let current = this._front;
    while (current) {
      items.push({ id: current.id, value: current.value });
      current = current.next;
    }
    this.state.items = items;
    this.state.head = this._front?.id ?? null;
    this.state.tail = this._back?.id ?? null;
    this.state.orientation = 'horizontal';
    return this.state;
  }

  *enqueue(value) {
    const node = this._enqueueNode(value);
    this._syncState();
    yield {
      type: 'enqueue',
      message: `Enqueued ${value} at the back of the queue.`,
      focus: [node.id],
    };
    yield {
      type: 'done',
      message: `The front of the queue is still ${this._front.value}.`,
    };
  }

  *dequeue() {
    if (!this._front) {
      yield { type: 'miss', message: 'Cannot dequeue: the queue is empty.', focus: [] };
      return null;
    }

    const node = this._front;
    yield {
      type: 'access',
      message: `The front of the queue contains ${node.value}.`,
      focus: [node.id],
    };

    this._front = node.next;
    if (!this._front) this._back = null;
    this._syncState();
    yield {
      type: 'dequeue',
      message: `Dequeued ${node.value} from the front of the queue.`,
      focus: this._front ? [this._front.id] : [],
    };
    return node.value;
  }

  *peek() {
    if (!this._front) {
      yield { type: 'miss', message: 'Cannot peek: the queue is empty.', focus: [] };
      return null;
    }
    yield {
      type: 'access',
      message: `The front of the queue is ${this._front.value}.`,
      focus: [this._front.id],
    };
    return this._front.value;
  }

  *isEmpty() {
    const empty = this._front === null;
    yield {
      type: 'visit',
      message: empty
        ? 'The queue is empty.'
        : `The queue contains ${this.state.items.length} elements.`,
      focus: empty ? [] : this.state.items.map((item) => item.id),
    };
    return empty;
  }
}
