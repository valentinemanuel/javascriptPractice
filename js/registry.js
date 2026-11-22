import { Stack } from './structures/stack.js';
import { Queue } from './structures/queue.js';
import { ArrayStructure } from './structures/array.js';
import { LinkedList } from './structures/linked-list.js';
import { compute as computeLinear } from './core/layout/linear.js';

/**
 * Adding a structure means adding one entry here. The app shell stays untouched.
 */
export const registry = {
  stack: {
    Structure: Stack,
    layout: computeLinear,
    group: 'Linear',
  },
  queue: {
    Structure: Queue,
    layout: computeLinear,
    group: 'Linear',
  },
  array: {
    Structure: ArrayStructure,
    layout: computeLinear,
    group: 'Linear',
  },
  'linked-list': {
    Structure: LinkedList,
    layout: computeLinear,
    group: 'Linear',
  },
};
