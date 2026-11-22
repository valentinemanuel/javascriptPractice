import { BaseStructure } from '../core/BaseStructure.js';

export const meta = {
  id: 'array',
  title: 'Array',
  group: 'Linear',
  layout: 'linear',
  description: 'A dynamic array stores values in contiguous cells with constant-time indexed access. When it fills up, its capacity doubles, and insertions shift later elements to the right.',
  demo: [5, 9, 2, 7],
  operations: {
    access: {
      signature: 'access(index)',
      label: 'Access',
      fields: [{ name: 'index', label: 'Index', type: 'number', placeholder: 'e.g. 0' }],
      description: 'Returns the value stored at the given index.',
      best: { symbol: 'Ω(1)', text: 'the index is used directly' },
      average: { symbol: 'Θ(1)', text: 'constant time regardless of size' },
      worst: { symbol: 'O(1)', text: 'a single array lookup' },
    },
    insert: {
      signature: 'insert(index, value)',
      label: 'Insert',
      fields: [
        { name: 'index', label: 'Index', type: 'number', placeholder: 'e.g. 2' },
        { name: 'value', label: 'Value', type: 'number', placeholder: 'e.g. 42' },
      ],
      description: 'Inserts a value at the given index, shifting later elements right and doubling the capacity when the array is full.',
      best: { symbol: 'Ω(1)', text: 'appending at the end with spare capacity' },
      average: { symbol: 'Θ(n)', text: 'half of the elements shift on average' },
      worst: { symbol: 'O(n)', text: 'all elements shift when inserting at the front; appending is amortized O(1) thanks to capacity doubling' },
    },
    delete: {
      signature: 'delete(index)',
      label: 'Delete',
      fields: [{ name: 'index', label: 'Index', type: 'number', placeholder: 'e.g. 1' }],
      description: 'Removes the value at the given index and shifts the following elements left.',
      best: { symbol: 'Ω(1)', text: 'removing the last element needs no shift' },
      average: { symbol: 'Θ(n)', text: 'half of the elements shift on average' },
      worst: { symbol: 'O(n)', text: 'every element after the first shifts left' },
    },
    search: {
      signature: 'search(value)',
      label: 'Search',
      fields: [{ name: 'value', label: 'Value', type: 'number', placeholder: 'e.g. 7' }],
      description: 'Finds the first index whose value equals the given value.',
      best: { symbol: 'Ω(1)', text: 'the value is in the first cell' },
      average: { symbol: 'Θ(n)', text: 'half of the cells are compared on average' },
      worst: { symbol: 'O(n)', text: 'every cell is compared before concluding the value is absent' },
    },
  },
};

export class ArrayStructure extends BaseStructure {
  static meta = meta;

  constructor() {
    super(meta, { items: [], capacity: 4, size: 0, orientation: 'horizontal' });
  }

  initialState() {
    return { items: [], capacity: 4, size: 0, orientation: 'horizontal' };
  }

  seed(values = []) {
    for (const value of values) {
      this._ensureCapacity();
      this.state.items.push({ id: this._createId('cell'), value });
    }
    this.state.size = this.state.items.length;
    return this;
  }

  /** Doubles the capacity when there is no free cell. Returns true if it grew. */
  _ensureCapacity() {
    if (this.state.items.length < this.state.capacity) return false;
    this.state.capacity *= 2;
    return true;
  }

  *access(index) {
    const size = this.state.items.length;
    if (!Number.isInteger(index) || index < 0 || index >= size) {
      yield {
        type: 'miss',
        message: `Index ${index} is out of range for an array of size ${size}.`,
        focus: [],
      };
      return null;
    }

    const item = this.state.items[index];
    yield {
      type: 'access',
      message: `The value at index ${index} is ${item.value}.`,
      focus: [item.id],
    };
    return item.value;
  }

  *insert(index, value) {
    const size = this.state.items.length;
    if (!Number.isInteger(index) || index < 0 || index > size) {
      yield {
        type: 'miss',
        message: `Cannot insert at index ${index}: the valid range is 0 through ${size}.`,
        focus: [],
      };
      return null;
    }

    if (this._ensureCapacity()) {
      yield {
        type: 'visit',
        message: `The array is full, so its capacity doubles to ${this.state.capacity}.`,
        focus: this.state.items.map((item) => item.id),
      };
    }

    const item = { id: this._createId('cell'), value };
    this.state.items.push(item);
    this.state.size = this.state.items.length;

    for (let i = this.state.items.length - 1; i > index; i -= 1) {
      const moving = this.state.items[i - 1];
      this.state.items[i] = moving;
      this.state.items[i - 1] = item;
      yield {
        type: 'shift',
        message: `Shifted ${moving.value} from index ${i - 1} to index ${i} to make room.`,
        focus: [moving.id, item.id],
      };
    }

    this.state.items[index] = item;
    yield {
      type: 'insert',
      message: `Inserted ${value} at index ${index}.`,
      focus: [item.id],
    };
    return value;
  }

  *delete(index) {
    const size = this.state.items.length;
    if (!Number.isInteger(index) || index < 0 || index >= size) {
      yield {
        type: 'miss',
        message: `Cannot delete index ${index}: the valid range is 0 through ${size - 1}.`,
        focus: [],
      };
      return null;
    }

    const removed = this.state.items[index];
    for (let i = index; i < size - 1; i += 1) {
      const moving = this.state.items[i + 1];
      this.state.items[i] = moving;
      this.state.items[i + 1] = removed;
      yield {
        type: 'shift',
        message: `Shifted ${moving.value} from index ${i + 1} to index ${i} to close the gap.`,
        focus: [moving.id, removed.id],
      };
    }

    this.state.items.pop();
    this.state.size = this.state.items.length;
    const neighbor = this.state.items[Math.min(index, this.state.items.length - 1)];
    yield {
      type: 'delete',
      message: `Deleted ${removed.value} from index ${index}.`,
      focus: neighbor ? [neighbor.id] : [],
    };
    return removed.value;
  }

  *search(value) {
    for (let index = 0; index < this.state.items.length; index += 1) {
      const item = this.state.items[index];
      yield {
        type: 'compare',
        message: `Compared ${item.value} at index ${index} with ${value}.`,
        focus: [item.id],
      };
      if (item.value === value) {
        yield {
          type: 'found',
          message: `Found ${value} at index ${index}.`,
          focus: [item.id],
        };
        return index;
      }
    }

    yield {
      type: 'miss',
      message: `${value} is not present in the array.`,
      focus: [],
    };
    return -1;
  }
}
