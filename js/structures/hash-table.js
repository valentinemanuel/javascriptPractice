import { BaseStructure } from '../core/BaseStructure.js';

/**
 * A hash table that supports four collision strategies and three hash
 * functions. All state uses stable ids so the renderer and layout stay in sync.
 */
const CAPACITIES = [7, 17, 37, 73, 163, 353, 761];
const INITIAL_CAPACITY = CAPACITIES[0];
const PRIME_P = 1009;
const GOLDEN_A = (Math.sqrt(5) - 1) / 2;
const LCG_MULTIPLIER = 1664525;
const LCG_INCREMENT = 1013904223;
const CHAINING_THRESHOLD = 1;
const OPEN_ADDRESSING_THRESHOLD = 0.75;
const QUADRATIC_THRESHOLD = 0.5;

const keyField = [{ name: 'key', label: 'Key', type: 'number', placeholder: 'e.g. 42' }];

const setterMeta = (name, label, description) => ({
  signature: `${name}()`,
  label,
  description,
  best: { symbol: 'Ω(n)', text: 'reinserting n stored keys is linear even with no collisions' },
  average: { symbol: 'Θ(n)', text: 'reinsert every one of the n stored keys' },
  worst: { symbol: 'O(n)', text: 'reinsert every one of the n stored keys' },
});

export const meta = {
  id: 'hash-table',
  title: 'Hash Table',
  group: 'Hashing',
  layout: 'hash',
  description:
    'A hash table maps numeric keys to buckets with a hash function. Separate chaining keeps a linked list per bucket, while linear probing, quadratic probing and double hashing place colliding keys in other slots. Universal hashing chooses (a, b) at random so any pair of distinct keys collides with probability at most 1/m, giving expected O(1) operations.',
  demo: [12, 25, 37, 4],
  operations: {
    put: {
      signature: 'put(key)',
      label: 'Put',
      fields: keyField,
      description:
        'Hashes the key, follows the collision strategy until a free slot or the key itself is found, then inserts or refreshes the value. The table grows at a load factor above 0.75 for open addressing or above 1 for chaining.',
      best: { symbol: 'Ω(1)', text: 'the home bucket is empty or already holds the key' },
      average: {
        symbol: 'Θ(1)',
        text: 'expected O(1) with a good hash; universal hashing bounds collisions by 1/m',
      },
      worst: { symbol: 'O(n)', text: 'all keys cluster in one long chain or probe trail' },
    },
    get: {
      signature: 'get(key)',
      label: 'Get',
      fields: keyField,
      description:
        'Hashes the key and follows the same probe sequence used by put, skipping tombstones, until the key is found or an empty slot ends the search.',
      best: { symbol: 'Ω(1)', text: 'the key sits directly in its home bucket' },
      average: {
        symbol: 'Θ(1)',
        text: 'expected O(1) with a good hash; universal hashing bounds collisions by 1/m',
      },
      worst: { symbol: 'O(n)', text: 'a long chain or probe cluster must be scanned' },
    },
    remove: {
      signature: 'remove(key)',
      label: 'Remove',
      fields: keyField,
      description:
        'Finds the key and unlinks it from its chain, or marks its slot with a tombstone for open addressing so later probes still reach keys behind it.',
      best: { symbol: 'Ω(1)', text: 'the key sits directly in its home bucket' },
      average: {
        symbol: 'Θ(1)',
        text: 'expected O(1) with a good hash; universal hashing bounds collisions by 1/m',
      },
      worst: { symbol: 'O(n)', text: 'a long chain or probe cluster must be scanned' },
    },
    useChaining: setterMeta(
      'useChaining',
      'Use chaining',
      'Switches to separate chaining and reinserts every stored key into a fresh table.',
    ),
    useLinearProbing: setterMeta(
      'useLinearProbing',
      'Use linear probing',
      'Switches to linear probing and reinserts every stored key into a fresh table.',
    ),
    useQuadraticProbing: setterMeta(
      'useQuadraticProbing',
      'Use quadratic probing',
      'Switches to quadratic probing with Q(i) = i² and reinserts every stored key. The table grows at load 0.5 so a free slot is always reachable.',
    ),
    useDoubleHashing: setterMeta(
      'useDoubleHashing',
      'Use double hashing',
      'Switches to double hashing with a second hash and reinserts every stored key into a fresh table.',
    ),
    useModuloHash: setterMeta(
      'useModuloHash',
      'Use modulo hash',
      'Switches to h(k) = k mod m and reinserts every stored key into a fresh table.',
    ),
    useMultiplicationHash: setterMeta(
      'useMultiplicationHash',
      'Use multiplication hash',
      'Switches to the Knuth multiplication hash with A = (sqrt(5) - 1) / 2 and reinserts every stored key.',
    ),
    useUniversalHashing: setterMeta(
      'useUniversalHashing',
      'Use universal hash',
      'Switches to h(k) = ((a*k + b) mod p) mod m, where any two keys collide with probability at most 1/m, and reinserts every stored key.',
    ),
    newUniversalFamily: setterMeta(
      'newUniversalFamily',
      'New universal family',
      'Advances the internal LCG seed to draw a new (a, b) pair and rehashes every stored key with it.',
    ),
  },
};

function positiveMod(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function lcgStep(seed) {
  return (LCG_MULTIPLIER * seed + LCG_INCREMENT) >>> 0;
}

function makeBuckets(capacity) {
  return Array.from({ length: capacity }, (_, index) => ({
    id: `bucket-${index}`,
    items: [],
  }));
}

function createInitialState() {
  return {
    buckets: makeBuckets(INITIAL_CAPACITY),
    capacity: INITIAL_CAPACITY,
    size: 0,
    strategy: 'chaining',
    hash: 'modulo',
    seed: 1,
    p: PRIME_P,
  };
}

export class HashTable extends BaseStructure {
  static meta = meta;

  constructor() {
    super(meta, createInitialState());
  }

  initialState() {
    return createInitialState();
  }

  seed(values = []) {
    for (const key of values ?? []) {
      for (const _step of this.put(key)) { /* steps are ignored while seeding */ }
    }
    return this;
  }

  _nextCapacity() {
    return CAPACITIES.find((candidate) => candidate > this.state.capacity) ?? null;
  }

  _universalParams() {
    const first = lcgStep(this.state.seed);
    const second = lcgStep(first);
    const p = this.state.p;
    return { a: 1 + positiveMod(first, p - 1), b: positiveMod(second, p) };
  }

  _hashIndex(key) {
    const m = this.state.capacity;
    if (this.state.hash === 'multiplication') {
      const product = key * GOLDEN_A;
      return Math.floor(m * (product - Math.floor(product)));
    }
    if (this.state.hash === 'universal') {
      const { a, b } = this._universalParams();
      const reduced = positiveMod(key, this.state.p);
      return positiveMod(a * reduced + b, this.state.p) % m;
    }
    return positiveMod(key, m);
  }

  /**
   * Independent second hash for double hashing. It depends on the key itself,
   * not on the home index, so keys that collide at home get different strides.
   */
  _hash2(key) {
    const m = this.state.capacity;
    return 1 + positiveMod(Math.trunc(key) % (m - 1), m - 1);
  }

  _contains(key) {
    const { indices } = this._probeIndices(key);
    for (const index of indices) {
      const bucket = this.state.buckets[index];
      if (!bucket) continue;
      if (this.state.strategy === 'chaining') {
        if (bucket.items.some((item) => !item.tombstone && item.value === key)) return true;
        break;
      }
      const item = bucket.items[0];
      if (!item) break;
      if (!item.tombstone && item.value === key) return true;
    }
    return false;
  }

  _probeIndices(key) {
    const m = this.state.capacity;
    const home = this._hashIndex(key);
    const indices = [];
    const seen = new Set();
    const add = (index) => {
      const normalized = positiveMod(index, m);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        indices.push(normalized);
      }
    };

    if (this.state.strategy === 'chaining') {
      add(home);
      return { home, indices };
    }
    if (this.state.strategy === 'linear') {
      for (let attempt = 0; attempt < m; attempt += 1) add(home + attempt);
    } else if (this.state.strategy === 'quadratic') {
      for (let attempt = 0; attempt < m; attempt += 1) add(home + attempt * attempt);
    } else if (this.state.strategy === 'double') {
      const step = this._hash2(key);
      for (let attempt = 0; attempt < m; attempt += 1) add(home + attempt * step);
    }

    return { home, indices };
  }

  _expression(key, index) {
    const m = this.state.capacity;
    if (key === undefined || !Number.isFinite(index)) return `${this.state.hash} hashing`;
    if (this.state.hash === 'modulo') return `${key} mod ${m} = ${index}`;
    if (this.state.hash === 'multiplication') {
      return `⌊${m} · frac(${key} × ${GOLDEN_A.toFixed(6)})⌋ ≈ ${index}`;
    }
    const { a, b } = this._universalParams();
    return `((${a}·${key} + ${b}) mod ${this.state.p}) mod ${m} = ${index}`;
  }

  _hashPayload(key, index) {
    const payload = {
      key,
      index,
      hash: this.state.hash,
      bucket: `bucket-${index}`,
      expression: this._expression(key, index),
    };
    if (this.state.hash === 'universal') {
      const { a, b } = this._universalParams();
      payload.a = a;
      payload.b = b;
      payload.p = this.state.p;
    }
    if (this.state.hash === 'multiplication') payload.a = GOLDEN_A;
    return payload;
  }

  _hashStep(key, index) {
    return {
      type: 'hash',
      message: `Key ${key} hashes to bucket-${index} using ${this.state.hash} hashing.`,
      focus: [`bucket-${index}`],
      payload: this._hashPayload(key, index),
    };
  }

  _probeMessage(key, index, attempt) {
    if (this.state.strategy === 'chaining') {
      return `Checked bucket-${index} for key ${key} in its chain on attempt ${attempt}.`;
    }
    if (this.state.strategy === 'linear') {
      return `Probed bucket-${index} for key ${key} with linear probing on attempt ${attempt}.`;
    }
    if (this.state.strategy === 'quadratic') {
      return `Probed bucket-${index} for key ${key} with quadratic probing on attempt ${attempt}.`;
    }
    return `Probed bucket-${index} for key ${key} with double hashing on attempt ${attempt}.`;
  }

  _probeStep(key, index, attempt, probedIds, expression) {
    return {
      type: 'probe',
      message: this._probeMessage(key, index, attempt),
      focus: [`bucket-${index}`],
      payload: {
        key,
        index,
        attempt,
        probe: [...probedIds],
        strategy: this.state.strategy,
        expression,
      },
    };
  }

  _liveItems() {
    return this.state.buckets
      .flatMap((bucket) => bucket.items)
      .filter((item) => !item.tombstone);
  }

  _insertLive(item) {
    const { indices } = this._probeIndices(item.value);
    for (const index of indices) {
      const bucket = this.state.buckets[index];
      if (this.state.strategy === 'chaining' || bucket.items.length === 0) {
        bucket.items.push(item);
        this.state.size += 1;
        return true;
      }
    }
    return false;
  }

  *_rehashTo(newCapacity) {
    const oldCapacity = this.state.capacity;
    const live = this._liveItems().map((item) => ({ id: item.id, value: item.value }));
    this.state.capacity = newCapacity;
    this.state.buckets = makeBuckets(newCapacity);
    this.state.size = 0;
    for (const item of live) this._insertLive(item);

    const verb = newCapacity > oldCapacity ? 'Grew' : 'Rebuilt';
    yield {
      type: 'rehash',
      message: `${verb} the table from capacity ${oldCapacity} to ${newCapacity} and rehashed ${live.length} key(s).`,
      focus: this.state.buckets.map((bucket) => bucket.id),
      payload: { from: oldCapacity, to: newCapacity, count: live.length },
    };
  }

  *_maybeRebuild() {
    const threshold = this.state.strategy === 'chaining'
      ? CHAINING_THRESHOLD
      : this.state.strategy === 'quadratic'
        ? QUADRATIC_THRESHOLD
        : OPEN_ADDRESSING_THRESHOLD;
    const occupied = this.state.buckets.filter((bucket) => bucket.items.length > 0).length;
    if (this.state.strategy !== 'chaining' && occupied === this.state.capacity) {
      yield* this._rehashTo(this.state.capacity);
    }
    if ((this.state.size + 1) / this.state.capacity > threshold) {
      const next = this._nextCapacity();
      if (next !== null) yield* this._rehashTo(next);
    }
  }

  *_walk(key) {
    const home = this._hashIndex(key);
    const { indices } = this._probeIndices(key);
    const probedIds = [];
    let firstTombstone = -1;
    let found = null;
    let foundIndex = -1;
    let emptyIndex = -1;
    const expression = this._expression(key, home);

    yield this._hashStep(key, indices[0] ?? home);

    for (let attempt = 0; attempt < indices.length; attempt += 1) {
      const index = indices[attempt];
      const bucketId = this.state.buckets[index].id;
      probedIds.push(bucketId);
      yield this._probeStep(key, index, attempt + 1, probedIds, expression);

      const bucket = this.state.buckets[index];
      if (this.state.strategy === 'chaining') {
        const match = bucket.items.find((item) => !item.tombstone && item.value === key);
        if (match) {
          found = match;
          foundIndex = index;
        } else {
          emptyIndex = index;
        }
        break;
      }
      if (bucket.items.length === 0) {
        emptyIndex = index;
        break;
      }
      const item = bucket.items[0];
      if (!item.tombstone && item.value === key) {
        found = item;
        foundIndex = index;
        break;
      }
      if (item.tombstone && firstTombstone === -1) firstTombstone = index;
    }

    return { home, indices, probedIds, firstTombstone, found, foundIndex, emptyIndex, expression };
  }

  *put(key) {
    if (!this._contains(key)) yield* this._maybeRebuild();
    const info = yield* this._walk(key);

    if (info.found) {
      info.found.value = key;
      yield {
        type: 'insert',
        message: `Key ${key} was already stored, so its value was refreshed in place.`,
        focus: [info.found.id],
        payload: { key, id: info.found.id, probe: info.probedIds, expression: info.expression },
      };
      return key;
    }

    let targetIndex = info.firstTombstone !== -1 ? info.firstTombstone : info.emptyIndex;
    if (targetIndex === -1) {
      const next = this._nextCapacity();
      yield* this._rehashTo(next ?? this.state.capacity);
      return yield* this.put(key);
    }

    const bucket = this.state.buckets[targetIndex];
    if (this.state.strategy === 'chaining' && bucket.items.length > 0) {
      yield {
        type: 'collision',
        message: `Bucket-${targetIndex} already holds items, so key ${key} was appended to its chain.`,
        focus: [bucket.id, ...bucket.items.map((entry) => entry.id)],
        payload: { key, index: targetIndex, bucket: bucket.id, probe: info.probedIds, expression: info.expression },
      };
    }
    let item;
    if (this.state.strategy === 'chaining' || bucket.items.length === 0) {
      item = { id: this._createId('item'), value: key };
      bucket.items.push(item);
    } else {
      item = bucket.items[0];
      item.tombstone = false;
      item.value = key;
    }
    this.state.size += 1;
    yield {
      type: 'insert',
      message: `Inserted key ${key} into bucket-${targetIndex}.`,
      focus: [item.id, bucket.id],
      payload: {
        key,
        id: item.id,
        index: targetIndex,
        bucket: bucket.id,
        probe: info.probedIds,
        expression: info.expression,
      },
    };
    return key;
  }

  *get(key) {
    const info = yield* this._walk(key);
    if (info.found) {
      yield {
        type: 'found',
        message: `Found key ${key} in bucket-${info.foundIndex}.`,
        focus: [info.found.id],
        payload: {
          key,
          id: info.found.id,
          index: info.foundIndex,
          bucket: this.state.buckets[info.foundIndex].id,
          probe: info.probedIds,
          expression: info.expression,
        },
      };
      return info.found.value;
    }
    yield {
      type: 'miss',
      message: `Key ${key} is not present in the table.`,
      focus: [],
      payload: { key, probe: info.probedIds, expression: info.expression },
    };
    return null;
  }

  *remove(key) {
    const info = yield* this._walk(key);
    if (!info.found) {
      yield {
        type: 'miss',
        message: `Key ${key} was not found, so nothing was removed.`,
        focus: [],
        payload: { key, probe: info.probedIds, expression: info.expression },
      };
      return null;
    }

    const tombstone = this.state.strategy !== 'chaining';
    if (tombstone) {
      info.found.tombstone = true;
    } else {
      const bucket = this.state.buckets[info.foundIndex];
      bucket.items = bucket.items.filter((item) => item.id !== info.found.id);
    }
    this.state.size -= 1;
    yield {
      type: 'delete',
      message: `Deleted key ${key} from bucket-${info.foundIndex}${tombstone ? ' and left a tombstone in its slot' : ''}.`,
      focus: [info.found.id],
      payload: {
        key,
        id: info.found.id,
        index: info.foundIndex,
        bucket: this.state.buckets[info.foundIndex].id,
        probe: info.probedIds,
        tombstone,
        expression: info.expression,
      },
    };
    return key;
  }

  *_rebuildAll(message, changes) {
    const live = this._liveItems().map((item) => ({ id: item.id, value: item.value }));
    Object.assign(this.state, changes);
    this.state.capacity = INITIAL_CAPACITY;
    this.state.buckets = makeBuckets(INITIAL_CAPACITY);
    this.state.size = 0;

    yield {
      type: 'info',
      message,
      focus: [],
      payload: {
        strategy: this.state.strategy,
        hash: this.state.hash,
        keys: live.map((item) => item.value),
      },
    };

    for (const item of live) {
      yield* this._maybeRebuild();
      this._insertLive(item);
    }
    yield {
      type: 'rehash',
      message: `Rehashed ${live.length} key(s) into a fresh table with capacity ${this.state.capacity}.`,
      focus: this.state.buckets.map((bucket) => bucket.id),
      payload: {
        count: live.length,
        capacity: this.state.capacity,
        strategy: this.state.strategy,
        hash: this.state.hash,
      },
    };
  }

  *useChaining() {
    yield* this._rebuildAll(
      'Switched to separate chaining and reinserted every stored key.',
      { strategy: 'chaining' },
    );
  }

  *useLinearProbing() {
    yield* this._rebuildAll(
      'Switched to linear probing and reinserted every stored key.',
      { strategy: 'linear' },
    );
  }

  *useQuadraticProbing() {
    yield* this._rebuildAll(
      'Switched to quadratic probing and reinserted every stored key.',
      { strategy: 'quadratic' },
    );
  }

  *useDoubleHashing() {
    yield* this._rebuildAll(
      'Switched to double hashing and reinserted every stored key.',
      { strategy: 'double' },
    );
  }

  *useModuloHash() {
    yield* this._rebuildAll(
      'Switched to the modulo hash and reinserted every stored key.',
      { hash: 'modulo' },
    );
  }

  *useMultiplicationHash() {
    yield* this._rebuildAll(
      'Switched to the multiplication hash and reinserted every stored key.',
      { hash: 'multiplication' },
    );
  }

  *useUniversalHashing() {
    yield* this._rebuildAll(
      'Switched to universal hashing and reinserted every stored key.',
      { hash: 'universal' },
    );
  }

  *newUniversalFamily() {
    const before = this._universalParams();
    this.state.seed = lcgStep(this.state.seed);
    const after = this._universalParams();
    yield {
      type: 'info',
      message: `Generated a new universal hashing family with a = ${after.a} and b = ${after.b} modulo p = ${this.state.p}.`,
      focus: [],
      payload: {
        a: after.a,
        b: after.b,
        p: this.state.p,
        previousA: before.a,
        previousB: before.b,
      },
    };
    yield* this._rebuildAll('Rehashed every stored key with the new universal parameters.', {});
  }
}
