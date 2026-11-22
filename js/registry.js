import { Stack } from './structures/stack.js';
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
};
