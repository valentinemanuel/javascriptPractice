import test from 'node:test';
import assert from 'node:assert/strict';
import { Trie, meta } from '../js/structures/trie.js';

function run(iterator) {
  let result = iterator.next();
  while (!result.done) result = iterator.next();
  return result.value;
}

function childId(state, fromId, label) {
  return state.edges.find((edge) => edge.from === fromId && edge.label === label)?.to ?? null;
}

function assertConsistent(state) {
  const ids = state.nodes.map((node) => node.id);
  assert.equal(new Set(ids).size, ids.length, 'node ids must be unique');
  assert.ok(ids.includes(state.root), 'the root id must refer to a node');

  for (const edge of state.edges) {
    assert.ok(ids.includes(edge.from), `edge source ${edge.from} must exist`);
    assert.ok(ids.includes(edge.to), `edge target ${edge.to} must exist`);
    assert.equal(edge.label.length, 1, 'edge labels must be a single character');
    assert.equal(edge.directed, true, 'trie edges must be directed');
  }

  const branchKeys = state.edges.map((edge) => `${edge.from}:${edge.label}`);
  assert.equal(new Set(branchKeys).size, branchKeys.length, 'no two edges may share a source and label');

  const reached = new Set([state.root]);
  const queue = [state.root];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    for (const edge of state.edges.filter((item) => item.from === queue[cursor])) {
      if (!reached.has(edge.to)) {
        reached.add(edge.to);
        queue.push(edge.to);
      }
    }
  }
  assert.equal(reached.size, ids.length, 'every node must be reachable from the root');
}

test('seed builds the demo trie with a single root and complete-word marks', () => {
  const state = new Trie().reset(['cat', 'car', 'dog', 'door']).getState();
  assert.equal(state.nodes[0].id, state.root);
  assert.equal(state.nodes[0].value, '');
  assert.equal(state.nodes[0].terminal, false);
  assert.equal(state.nodes.length, 10);
  assert.equal(state.edges.length, 9);
  assert.equal(state.nodes.filter((node) => node.terminal).length, 4);
  assertConsistent(state);
});

test('insert then search finds stored words and rejects missing ones', () => {
  const trie = new Trie().reset();
  const steps = [...trie.insert('hello')];
  assert.equal(steps.filter((step) => step.type === 'visit').length, 5);
  assert.equal(steps.at(-1).type, 'insert');
  assert.equal(run(trie.search('hello')), true);
  assert.equal(run(trie.search('hell')), false);
  assert.equal(run(trie.search('hello!')), false);
  assert.equal(run(trie.search('')), false);
});

test('search yields a final miss step for absent words and prefix-only matches', () => {
  const trie = new Trie().reset(['cat']);
  const missing = [...trie.search('cab')];
  assert.equal(missing.at(-1).type, 'miss');
  assert.ok(missing.at(-1).message.endsWith('.'));

  const prefixOnly = [...trie.search('ca')];
  assert.equal(prefixOnly.at(-1).type, 'miss');
  assert.match(prefixOnly.at(-1).message, /prefix/i);

  const found = [...trie.search('cat')];
  assert.equal(found.at(-1).type, 'found');
});

test('startsWith checks prefixes without requiring a terminal node', () => {
  const trie = new Trie().reset(['cat', 'car', 'dog']);
  assert.equal(run(trie.startsWith('ca')), true);
  assert.equal(run(trie.startsWith('dog')), true);
  assert.equal(run(trie.startsWith('cax')), false);
  assert.equal(run(trie.startsWith('z')), false);
  assert.equal(run(trie.startsWith('')), true);
  assert.equal([...trie.startsWith('ca')].at(-1).type, 'found');
  assert.equal([...trie.startsWith('cax')].at(-1).type, 'miss');
});

test('shared prefixes are stored once and duplicate inserts add no nodes', () => {
  const trie = new Trie().reset(['cat', 'car']);
  const state = trie.getState();
  const c = childId(state, state.root, 'c');
  assert.ok(c);
  assert.equal(state.edges.filter((edge) => edge.from === state.root).length, 1);

  const a = childId(state, c, 'a');
  assert.ok(a);
  assert.equal(state.edges.filter((edge) => edge.from === c).length, 1);
  assert.deepEqual(
    state.edges.filter((edge) => edge.from === a).map((edge) => edge.label).sort(),
    ['r', 't'],
  );
  assert.equal(state.nodes.length, 5);

  run(trie.insert('cat'));
  assert.equal(trie.getState().nodes.length, 5);
  assert.equal(trie.getState().nodes.filter((node) => node.terminal).length, 2);
  assertConsistent(trie.getState());
});

test('delete unmarks the terminal node and prunes unused suffix nodes', () => {
  const trie = new Trie().reset(['cat']);
  const steps = [...trie.delete('cat')];
  assert.equal(steps[0].type, 'delete');
  assert.equal(steps.filter((step) => step.type === 'remove').length, 3);
  assert.ok(steps.every((step) => step.message.endsWith('.')));

  const state = trie.getState();
  assert.equal(state.nodes.length, 1);
  assert.equal(state.edges.length, 0);
  assert.equal(state.nodes[0].terminal, false);
  assert.equal(run(trie.search('cat')), false);
  assert.equal(run(trie.startsWith('ca')), false);
  assertConsistent(state);
});

test('deleting a word that is a prefix of another keeps the longer word', () => {
  const trie = new Trie().reset(['cat', 'cats']);
  const steps = [...trie.delete('cat')];
  assert.equal(steps.filter((step) => step.type === 'remove').length, 0);
  assert.equal(run(trie.search('cat')), false);
  assert.equal(run(trie.search('cats')), true);
  assert.equal(trie.getState().nodes.length, 5);
  assertConsistent(trie.getState());
});

test('deleting a shared-prefix word prunes only its own suffix', () => {
  const trie = new Trie().reset(['cat', 'car']);
  const steps = [...trie.delete('car')];
  assert.equal(steps.filter((step) => step.type === 'remove').length, 1);
  assert.equal(run(trie.search('car')), false);
  assert.equal(run(trie.search('cat')), true);
  assert.equal(trie.getState().nodes.length, 4);
  assertConsistent(trie.getState());
});

test('deleting a missing word or a prefix-only string leaves state unchanged', () => {
  const trie = new Trie().reset(['cat']);
  const before = JSON.parse(JSON.stringify(trie.getState()));

  const missing = [...trie.delete('car')];
  assert.equal(missing.at(-1).type, 'miss');
  assert.deepEqual(trie.getState(), before);

  const prefixOnly = [...trie.delete('ca')];
  assert.equal(prefixOnly.at(-1).type, 'miss');
  assert.deepEqual(trie.getState(), before);
});

test('state and edges stay consistent after mixed operations', () => {
  const trie = new Trie().reset(['cat', 'car', 'dog', 'door']);
  run(trie.insert('dove'));
  run(trie.delete('cat'));
  run(trie.delete('door'));
  run(trie.insert('dove'));
  run(trie.delete('dog'));
  assertConsistent(trie.getState());
  assert.equal(run(trie.search('dove')), true);
  assert.equal(run(trie.search('door')), false);
  assert.equal(run(trie.search('cat')), false);
  assert.equal(run(trie.search('car')), true);
});

test('ids are stable and reset with the structure', () => {
  const trie = new Trie().reset(['cat']);
  assert.equal(trie.getState().root, 't1');
  assert.equal(trie.getState().nodes[1].id, 't2');
  trie.reset(['dog']);
  assert.equal(trie.getState().root, 't1');
  assert.equal(trie.getState().nodes[1].id, 't2');
  assert.deepEqual(trie.getState().nodes.map((node) => node.value), ['', 'd', 'o', 'g']);
});

test('the empty word is supported end to end', () => {
  const trie = new Trie().reset();
  const steps = [...trie.insert('')];
  assert.equal(steps.filter((step) => step.type === 'visit').length, 0);
  assert.equal(run(trie.search('')), true);
  assert.equal(run(trie.startsWith('')), true);
  assert.equal(trie.getState().nodes[0].terminal, true);

  run(trie.delete(''));
  assert.equal(trie.getState().nodes[0].terminal, false);
  assert.equal(run(trie.search('')), false);
  assert.equal(trie.getState().nodes.length, 1);
});

test('the class exposes static metadata and demo words for the app shell', () => {
  assert.equal(Trie.meta, meta);
  assert.equal(meta.id, 'trie');
  assert.equal(meta.title, 'Trie');
  assert.equal(meta.group, 'Trees');
  assert.equal(meta.layout, 'tree');
  assert.deepEqual(meta.demo, ['cat', 'car', 'dog', 'door']);
});

test('operations declare their string fields in order', () => {
  const expected = { insert: 'word', search: 'word', startsWith: 'prefix', delete: 'word' };
  for (const [name, fieldName] of Object.entries(expected)) {
    const fields = meta.operations[name].fields;
    assert.equal(fields.length, 1, name);
    assert.equal(fields[0].name, fieldName, name);
    assert.equal(fields[0].type, 'string', name);
    assert.equal(typeof fields[0].label, 'string', name);
  }
});

test('metadata declares Omega, Theta and Big O with the word length L', () => {
  const notation = { best: 'Ω(L)', average: 'Θ(L)', worst: 'O(L)' };
  for (const [name, operation] of Object.entries(meta.operations)) {
    assert.equal(typeof operation.description, 'string', name);
    for (const [bound, symbol] of Object.entries(notation)) {
      assert.equal(operation[bound].symbol, symbol, `${name}.${bound}`);
      assert.equal(typeof operation[bound].text, 'string', `${name}.${bound}`);
      assert.ok(operation[bound].text.length > 0, `${name}.${bound}`);
    }
  }
});

test('every yielded step is well formed', () => {
  const trie = new Trie().reset(['cat', 'car']);
  const operations = [
    trie.insert('cart'),
    trie.search('cat'),
    trie.search('dog'),
    trie.startsWith('ca'),
    trie.startsWith('x'),
    trie.delete('car'),
    trie.delete('missing'),
  ];
  for (const operation of operations) {
    for (const step of operation) {
      assert.equal(typeof step.type, 'string');
      assert.ok(step.type.length > 0);
      assert.equal(typeof step.message, 'string');
      assert.ok(step.message.endsWith('.'), step.message);
      assert.ok(Array.isArray(step.focus));
      const present = new Set(trie.getState().nodes.map((node) => node.id));
      for (const id of step.focus) {
        assert.equal(typeof id, 'string');
        assert.ok(present.has(id), `focus id ${id} must exist in the current state`);
      }
    }
  }
});
