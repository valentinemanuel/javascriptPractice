import { Stack } from './structures/stack.js';
import { Queue } from './structures/queue.js';
import { ArrayStructure } from './structures/array.js';
import { LinkedList } from './structures/linked-list.js';
import { BinarySearchTree } from './structures/bst.js';
import { AvlTree } from './structures/avl.js';
import { BTree } from './structures/btree.js';
import { BPlusTree } from './structures/b-plus-tree.js';
import { Trie } from './structures/trie.js';
import { NaryTree } from './structures/n-ary-tree.js';
import { HashTable } from './structures/hash-table.js';
import { Graph } from './structures/graph.js';
import { compute as computeLinear } from './core/layout/linear.js';
import { compute as computeTree } from './core/layout/tree.js';
import { compute as computeMultiKey } from './core/layout/multiKey.js';
import { compute as computeHash } from './core/layout/hash.js';
import { compute as computeForce } from './core/layout/force.js';

/**
 * Adding a structure means adding one entry here. The app shell stays untouched.
 */
export const registry = {
  stack: { Structure: Stack, layout: computeLinear, group: 'Linear' },
  queue: { Structure: Queue, layout: computeLinear, group: 'Linear' },
  array: { Structure: ArrayStructure, layout: computeLinear, group: 'Linear' },
  'linked-list': { Structure: LinkedList, layout: computeLinear, group: 'Linear' },
  bst: { Structure: BinarySearchTree, layout: computeTree, group: 'Trees' },
  avl: { Structure: AvlTree, layout: computeTree, group: 'Trees' },
  btree: { Structure: BTree, layout: computeMultiKey, group: 'Trees' },
  'b-plus-tree': { Structure: BPlusTree, layout: computeMultiKey, group: 'Trees' },
  trie: { Structure: Trie, layout: computeTree, group: 'Trees' },
  'n-ary-tree': { Structure: NaryTree, layout: computeTree, group: 'Trees' },
  'hash-table': { Structure: HashTable, layout: computeHash, group: 'Hashing' },
  graph: { Structure: Graph, layout: computeForce, group: 'Graphs' },
};
