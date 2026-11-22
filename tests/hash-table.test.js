import test from 'node:test';
import assert from 'node:assert/strict';
import { HashTable, meta } from '../js/structures/hash-table.js';
import { compute as computeHashLayout } from '../js/core/layout/hash.js';

function run(iterator) {
  let result = iterator.next();
  while (!result.done) result = iterator.next();
  return result.value;
}

const STRATEGY_SETTERS = {
  chaining: 'useChaining',
  linear: 'useLinearProbing',
  quadratic: 'useQuadraticProbing',
  double: 'useDoubleHashing',
};

const HASH_SETTERS = {
  modulo: 'useModuloHash',
  multiplication: 'useMultiplicationHash',
  universal: 'useUniversalHashing',
};

function build(strategy = 'chaining', hash = 'modulo', keys = []) {
  const table = new HashTable().reset();
  run(table[STRATEGY_SETTERS[strategy]]());
  run(table[HASH_SETTERS[hash]]());
  for (const key of keys) run(table.put(key));
  return table;
}

function bucketOf(table, key) {
  return table.getState().buckets.find((bucket) =>
    bucket.items.some((item) => item.value === key && !item.tombstone),
  );
}

function allItems(table) {
  return table.getState().buckets.flatMap((bucket) => bucket.items);
}

function probeIndices(table, key) {
  const steps = [...table.get(key)];
  return steps
    .filter((step) => step.type === 'probe')
    .map((step) => step.payload.index);
}

test('initial state has the exact declared shape and deterministic bucket ids', () => {
  const state = new HashTable().getState();
  assert.deepEqual(Object.keys(state).sort(), [
    'buckets', 'capacity', 'hash', 'p', 'seed', 'size', 'strategy',
  ]);
  assert.deepEqual(state.buckets.map((bucket) => bucket.id), Array.from(
    { length: 7 }, (_, index) => `bucket-${index}`,
  ));
  assert.equal(state.capacity, 7);
  assert.equal(state.size, 0);
  assert.equal(state.strategy, 'chaining');
  assert.equal(state.hash, 'modulo');
  assert.equal(state.p, 1009);
  assert.equal(typeof state.seed, 'number');
});

test('seed inserts every value and bucket items carry id and value', () => {
  const table = new HashTable().reset([1, 8, 15]);
  const items = allItems(table);
  assert.equal(items.length, 3);
  for (const item of items) {
    assert.equal(typeof item.id, 'string');
    assert.ok('value' in item);
  }
  assert.equal(table.getState().size, 3);
  assert.ok(bucketOf(table, 1));
  assert.ok(bucketOf(table, 8));
  assert.ok(bucketOf(table, 15));
});

test('chaining places colliding keys in one linked list and yields a collision step', () => {
  const table = build('chaining', 'modulo', []);
  run(table.put(1));
  const steps = [...table.put(8)];
  assert.ok(steps.some((step) => step.type === 'hash'), 'a hash step is emitted');
  assert.ok(steps.some((step) => step.type === 'collision'), 'a collision step is emitted');
  assert.equal(steps.at(-1).type, 'insert');
  const bucket = bucketOf(table, 1);
  assert.equal(bucket.id, 'bucket-1');
  assert.deepEqual(bucket.items.map((item) => item.value), [1, 8]);
  assert.equal(run(table.get(8)), 8);
});

test('linear probing probes consecutive slots after a collision', () => {
  const table = build('linear', 'modulo', [1]);
  const steps = [...table.put(8)];
  const probes = steps.filter((step) => step.type === 'probe');
  assert.deepEqual(probes.map((step) => step.payload.index), [1, 2]);
  assert.deepEqual(probes.at(-1).payload.probe, ['bucket-1', 'bucket-2']);
  assert.equal(steps.at(-1).type, 'insert');
  assert.equal(bucketOf(table, 8).id, 'bucket-2');
});

test('quadratic probing follows the 0, 1, 4 offset sequence', () => {
  const table = build('quadratic', 'modulo', [1, 8]);
  const steps = [...table.put(15)];
  const probes = steps.filter((step) => step.type === 'probe');
  assert.deepEqual(probes.map((step) => step.payload.index), [1, 2, 5]);
  assert.deepEqual(probes.at(-1).payload.probe, ['bucket-1', 'bucket-2', 'bucket-5']);
  assert.equal(bucketOf(table, 15).id, 'bucket-5');
});

test('double hashing derives an independent stride from the key', () => {
  const table = build('double', 'modulo', [1, 8]);
  const steps = [...table.put(15)];
  const probes = steps.filter((step) => step.type === 'probe');
  // m = 7: key 15 has home 1 and stride 1 + (15 mod 6) = 4, so 1 -> 5.
  assert.deepEqual(probes.map((step) => step.payload.index), [1, 5]);
  assert.deepEqual(probes.at(-1).payload.probe, ['bucket-1', 'bucket-5']);
  assert.equal(bucketOf(table, 15).id, 'bucket-5');
});

test('a tombstone keeps its id and preserves lookups behind it', () => {
  const table = build('linear', 'modulo', [1, 8, 15]);
  const victim = bucketOf(table, 8).items[0];
  const victimId = victim.id;
  const deleteSteps = [...table.remove(8)];
  assert.equal(deleteSteps.at(-1).type, 'delete');
  assert.equal(deleteSteps.at(-1).payload.tombstone, true);

  const tombstone = allItems(table).find((item) => item.id === victimId);
  assert.ok(tombstone, 'the deleted slot still exists');
  assert.equal(tombstone.tombstone, true);
  assert.equal(bucketOf(table, 8), undefined);

  assert.equal(run(table.get(15)), 15, 'the probe chain behind the tombstone still works');
  assert.equal(run(table.get(8)), null);
  assert.equal(table.getState().size, 2);
});

test('a reclaimed tombstone slot reuses its id rather than creating a new one', () => {
  const table = build('linear', 'modulo', [1, 8]);
  const victimId = bucketOf(table, 8).items[0].id;
  run(table.remove(8));
  run(table.put(22));
  const reused = allItems(table).find((item) => item.value === 22);
  assert.equal(reused.id, victimId);
  assert.notEqual(reused.tombstone, true);
});

test('open addressing grows with a rehash step and respects the load bound', () => {
  const table = build('linear', 'modulo', []);
  let rehashSeen = false;
  for (let key = 1; key <= 12; key += 1) {
    const steps = [...table.put(key)];
    rehashSeen ||= steps.some((step) => step.type === 'rehash');
  }
  const state = table.getState();
  assert.ok(rehashSeen, 'growth emits a rehash step');
  assert.ok(state.capacity > 7);
  assert.ok(state.size / state.capacity <= 0.75);
  assert.ok(state.buckets.every((bucket) => bucket.items.length <= 1));
});

test('chaining grows only past a load factor of one', () => {
  const table = build('chaining', 'modulo', []);
  for (let key = 0; key < 7; key += 1) run(table.put(key));
  assert.equal(table.getState().capacity, 7);
  run(table.put(100));
  assert.equal(table.getState().capacity, 17);
  assert.ok(table.getState().size / table.getState().capacity <= 1);
});

test('every hash function produces its documented home index', () => {
  const key = 10;
  const modulo = build('linear', 'modulo', []);
  const moduloSteps = [...modulo.put(key)];
  assert.equal(moduloSteps[0].type, 'hash');
  const moduloIndex = ((key % 7) + 7) % 7;
  assert.equal(moduloSteps[0].payload.index, moduloIndex);
  assert.equal(moduloSteps[0].payload.expression, `${key} mod 7 = ${moduloIndex}`);

  const multiplication = build('linear', 'multiplication', []);
  const multiplicationSteps = [...multiplication.put(key)];
  const golden = (Math.sqrt(5) - 1) / 2;
  const expectedMultiplication = Math.floor(7 * (key * golden - Math.floor(key * golden)));
  assert.equal(multiplicationSteps[0].payload.index, expectedMultiplication);
  assert.equal(multiplicationSteps[0].payload.a, golden);
  assert.match(multiplicationSteps[0].payload.expression, /frac\(10 × 0\.618034\)/);

  const universal = build('linear', 'universal', []);
  const universalSteps = [...universal.put(key)];
  const state = universal.getState();
  const first = (1664525 * state.seed + 1013904223) >>> 0;
  const second = (1664525 * first + 1013904223) >>> 0;
  const a = 1 + (((first % (state.p - 1)) + state.p - 1) % (state.p - 1));
  const b = ((second % state.p) + state.p) % state.p;
  const expectedUniversal = ((a * key + b) % state.p) % state.capacity;
  assert.equal(universalSteps[0].payload.index, expectedUniversal);
  assert.equal(universalSteps[0].payload.a, a);
  assert.equal(universalSteps[0].payload.b, b);
  assert.equal(universalSteps[0].payload.p, state.p);
  assert.equal(
    universalSteps[0].payload.expression,
    `((${a}·${key} + ${b}) mod ${state.p}) mod ${state.capacity} = ${expectedUniversal}`,
  );
});

test('newUniversalFamily advances the LCG pair and changes indices', () => {
  const table = build('chaining', 'universal', []);
  for (let key = 0; key < 20; key += 1) run(table.put(key));
  const before = probeIndices(table, 3);
  const firstSteps = [...table.newUniversalFamily()];
  const info = firstSteps[0];
  assert.equal(info.type, 'info');
  assert.ok(info.message.includes(`a = ${info.payload.a}`));
  assert.ok(info.message.includes(`b = ${info.payload.b}`));
  assert.notEqual(info.payload.a, info.payload.previousA);
  assert.notEqual(info.payload.b, info.payload.previousB);
  assert.notDeepEqual(probeIndices(table, 3), before, 'keys are rehashed with the new pair');
});

test('every configuration setter preserves all existing keys', () => {
  const keys = [3, 10, 17, 24, 8, 31];
  const setters = Object.values(STRATEGY_SETTERS)
    .concat(Object.values(HASH_SETTERS))
    .concat(['newUniversalFamily']);

  for (const setter of setters) {
    const table = build('linear', 'modulo', keys);
    const steps = [...table[setter]()];
    assert.equal(steps[0].type, 'info', `${setter} starts with an info step`);
    for (const key of keys) {
      assert.equal(run(table.get(key)), key, `${setter} preserves key ${key}`);
    }
    assert.equal(table.getState().size, keys.length);
  }
});

test('setters actually update strategy and hash', () => {
  const table = build('chaining', 'modulo', [1, 2]);
  run(table.useQuadraticProbing());
  assert.equal(table.getState().strategy, 'quadratic');
  run(table.useMultiplicationHash());
  assert.equal(table.getState().hash, 'multiplication');
  run(table.useDoubleHashing());
  assert.equal(table.getState().strategy, 'double');
  run(table.useUniversalHashing());
  assert.equal(table.getState().hash, 'universal');
  run(table.useModuloHash());
  assert.equal(table.getState().hash, 'modulo');
  run(table.useLinearProbing());
  assert.equal(table.getState().strategy, 'linear');
  run(table.useChaining());
  assert.equal(table.getState().strategy, 'chaining');
});

test('get reports found and miss for every strategy', () => {
  for (const strategy of Object.keys(STRATEGY_SETTERS)) {
    const table = build(strategy, 'modulo', [4, 11, 18]);
    const foundSteps = [...table.get(11)];
    assert.equal(foundSteps.at(-1).type, 'found', strategy);
    assert.equal(foundSteps.at(-1).payload.id.length > 0, true);
    assert.equal(run(table.get(11)), 11);

    const missSteps = [...table.get(99)];
    assert.equal(missSteps.at(-1).type, 'miss', strategy);
    assert.equal(run(table.get(99)), null);
  }
});

test('remove reports found and missing keys across strategies', () => {
  for (const strategy of Object.keys(STRATEGY_SETTERS)) {
    const table = build(strategy, 'modulo', [4, 11, 18]);
    assert.equal(run(table.remove(11)), 11, strategy);
    assert.equal(run(table.get(11)), null, strategy);
    assert.equal(table.getState().size, 2, strategy);

    const missSteps = [...table.remove(77)];
    assert.equal(missSteps.at(-1).type, 'miss', strategy);
    assert.equal(run(table.remove(77)), null, strategy);
    assert.equal(table.getState().size, 2, strategy);
  }
});

test('ids stay unique across growth and configuration changes', () => {
  const table = build('chaining', 'modulo', []);
  for (let key = 0; key < 30; key += 1) run(table.put(key));
  run(table.useLinearProbing());
  run(table.useUniversalHashing());
  run(table.newUniversalFamily());
  const items = allItems(table);
  const ids = items.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  const buckets = table.getState().buckets.map((bucket) => bucket.id);
  assert.equal(new Set(buckets).size, buckets.length);
  buckets.forEach((id, index) => assert.equal(id, `bucket-${index}`));
});

test('reset clears state and restarts ids', () => {
  const table = new HashTable().reset([1, 2, 3]);
  table.reset([9]);
  assert.equal(table.getState().size, 1);
  assert.deepEqual(allItems(table).map((item) => item.value), [9]);
  assert.equal(allItems(table)[0].id, 'item1');
  assert.equal(table.getState().capacity, 7);
});

test('all steps are well formed and probe arrays only contain valid bucket ids', () => {
  for (const strategy of Object.keys(STRATEGY_SETTERS)) {
    for (const hash of Object.keys(HASH_SETTERS)) {
      const table = build(strategy, hash, [2, 9, 16]);
      const operations = [
        table.put(23),
        table.get(9),
        table.get(50),
        table.remove(2),
        table.remove(99),
        table[STRATEGY_SETTERS[strategy]](),
        table[HASH_SETTERS[hash]](),
        table.newUniversalFamily(),
      ];
      for (const operation of operations) {
        for (const step of operation) {
          const validBuckets = new Set(table.getState().buckets.map((bucket) => bucket.id));
          assert.equal(typeof step.type, 'string');
          assert.ok(step.type.length > 0);
          assert.equal(typeof step.message, 'string');
          assert.ok(step.message.endsWith('.'), step.message);
          assert.ok(Array.isArray(step.focus ?? []));
          for (const id of step.focus ?? []) assert.equal(typeof id, 'string');
          if (step.payload?.probe !== undefined) {
            assert.ok(Array.isArray(step.payload.probe));
            for (const id of step.payload.probe) {
              assert.equal(validBuckets.has(id), true, `${id} must be a real bucket`);
            }
          }
        }
      }
    }
  }
});

test('metadata declares Omega, Theta, Big O and key fields', () => {
  assert.equal(HashTable.meta, meta);
  assert.equal(meta.id, 'hash-table');
  const notation = { best: 'Ω', average: 'Θ', worst: 'O' };
  for (const [name, operation] of Object.entries(meta.operations)) {
    assert.equal(typeof operation.description, 'string', name);
    assert.ok(operation.description.endsWith('.'), name);
    for (const [bound, prefix] of Object.entries(notation)) {
      assert.equal(typeof operation[bound].symbol, 'string', `${name}.${bound}`);
      assert.ok(operation[bound].symbol.startsWith(prefix), `${name}.${bound} notation`);
      assert.equal(typeof operation[bound].text, 'string', `${name}.${bound}`);
    }
  }
  for (const name of ['put', 'get', 'remove']) {
    assert.deepEqual(meta.operations[name].fields, [
      { name: 'key', label: 'Key', type: 'number', placeholder: 'e.g. 42' },
    ]);
  }
  assert.ok(meta.operations.get.average.text.includes('1/m'));
  assert.ok(meta.description.includes('expected O(1)'));
});

test('the hash layout keeps a position for tombstone items', () => {
  const table = build('linear', 'modulo', [1, 8]);
  run(table.remove(1));
  const tombstone = table.getState().buckets
    .flatMap((bucket) => bucket.items)
    .find((item) => item.tombstone);
  assert.ok(tombstone, 'a logical deletion must leave a tombstone');
  const positions = computeHashLayout(table.getState(), { width: 900, height: 560 });
  assert.ok(positions.has(tombstone.id));
});

test('the hash layout produces textbook slot and chain positions', () => {
  const chaining = build('chaining', 'modulo', [1, 8, 15]);
  const chained = computeHashLayout(chaining.getState(), { width: 900, height: 560 });
  assert.ok(chained.has('__hash'), 'the hash function box must have a position');
  assert.ok(chained.has('__table'), 'the Index/Value table must have a position');
  const chain = chained.get('__chain');
  assert.ok(chain.x + (chain.max - 1) * chain.step + 22 <= 900, 'chain nodes must stay in the viewport');
  for (const bucket of chaining.getState().buckets) {
    assert.ok(chained.has(bucket.id), `bucket ${bucket.id} must have a table row`);
    const row = chained.get(bucket.id);
    assert.ok(row.x + row.width / 2 <= 900, `${bucket.id} must not be clipped`);
    for (const item of bucket.items) {
      assert.ok(chained.has(item.id), `item ${item.id} must have a key position`);
      assert.ok(chained.get(item.id).x < row.x, 'keys are drawn left of the table');
    }
  }

  const probing = build('linear', 'modulo', [1, 8]);
  const probed = computeHashLayout(probing.getState(), { width: 900, height: 560 });
  for (const bucket of probing.getState().buckets) {
    for (const item of bucket.items) {
      assert.ok(probed.has(item.id));
      assert.ok(probed.get(item.id).x < probed.get(bucket.id).x);
    }
  }
});
