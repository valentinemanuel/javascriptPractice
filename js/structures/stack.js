import { BaseStructure } from '../core/BaseStructure.js';

export const meta = {
  id: 'stack',
  title: 'Stack',
  group: 'Linear',
  layout: 'linear',
  description: 'A last-in, first-out (LIFO) collection. Elements are added and removed from the same end, called the top.',
  demo: [3, 7, 12],
  operations: {
    push: {
      signature: 'push(value)',
      label: 'Push',
      fields: [{ name: 'value', label: 'Value', type: 'number', placeholder: 'e.g. 42' }],
      description: 'Adds an element on top of the stack.',
      best: { symbol: 'Ω(1)', text: 'single pointer update' },
      average: { symbol: 'Θ(1)', text: 'constant time' },
      worst: { symbol: 'O(1)', text: 'no resizing in this model' },
    },
    pop: {
      signature: 'pop()',
      label: 'Pop',
      description: 'Removes and returns the element on top of the stack.',
      best: { symbol: 'Ω(1)', text: 'single pointer update' },
      average: { symbol: 'Θ(1)', text: 'constant time' },
      worst: { symbol: 'O(1)', text: 'constant time' },
    },
    peek: {
      signature: 'peek()',
      label: 'Peek',
      description: 'Returns the top element without removing it.',
      best: { symbol: 'Ω(1)', text: 'direct access' },
      average: { symbol: 'Θ(1)', text: 'constant time' },
      worst: { symbol: 'O(1)', text: 'constant time' },
    },
    isEmpty: {
      signature: 'isEmpty()',
      label: 'Is empty',
      description: 'Reports whether the stack contains no elements.',
      best: { symbol: 'Ω(1)', text: 'length check' },
      average: { symbol: 'Θ(1)', text: 'constant time' },
      worst: { symbol: 'O(1)', text: 'constant time' },
    },
  },
};

export class Stack extends BaseStructure {
  static meta = meta;

  constructor() {
    super(meta, { items: [], top: null, orientation: 'vertical' });
  }

  initialState() {
    return { items: [], top: null, orientation: 'vertical' };
  }

  seed(values = []) {
    for (const value of values) this._pushItem(value);
    return this;
  }

  _pushItem(value) {
    const item = { id: this._createId('item'), value };
    this.state.items.push(item);
    this.state.top = item.id;
    return item;
  }

  *push(value) {
    const item = this._pushItem(value);
    yield {
      type: 'push',
      message: `Pushed ${value} on top of the stack.`,
      focus: [item.id],
    };
    yield { type: 'done', message: `The top of the stack is now ${value}.` };
  }

  *pop() {
    if (this.state.items.length === 0) {
      yield { type: 'miss', message: 'Cannot pop: the stack is empty.' };
      return null;
    }

    const item = this.state.items.pop();
    this.state.top = this.state.items.at(-1)?.id ?? null;
    yield {
      type: 'pop',
      message: `Popped ${item.value} from the top of the stack.`,
      focus: this.state.top ? [this.state.top] : [],
    };
    return item.value;
  }

  *peek() {
    const top = this.state.items.at(-1);
    if (!top) {
      yield { type: 'miss', message: 'Cannot peek: the stack is empty.' };
      return null;
    }
    yield {
      type: 'access',
      message: `The top of the stack is ${top.value}.`,
      focus: [top.id],
    };
    return top.value;
  }

  *isEmpty() {
    const empty = this.state.items.length === 0;
    yield {
      type: 'visit',
      message: empty
        ? 'The stack is empty.'
        : `The stack contains ${this.state.items.length} elements.`,
      focus: empty ? [] : this.state.items.map((item) => item.id),
    };
    return empty;
  }
}
