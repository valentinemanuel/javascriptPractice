import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEFT_KEY,
  RIGHT_KEY,
  initialSidebarState,
  readSidebarVisibility,
  sidebarClasses,
  writeSidebarVisibility,
} from '../js/utils/sidebar.js';

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

test('sidebar visibility is read from storage with sensible defaults', () => {
  assert.deepEqual(readSidebarVisibility(null), { left: true, right: true });
  assert.deepEqual(readSidebarVisibility(fakeStorage()), { left: true, right: true });
  assert.deepEqual(
    readSidebarVisibility(fakeStorage({ [LEFT_KEY]: 'false', [RIGHT_KEY]: 'true' })),
    { left: false, right: true },
  );
});

test('sidebar visibility is persisted and restored independently', () => {
  const storage = fakeStorage();
  writeSidebarVisibility(storage, { left: false, right: true });
  assert.equal(storage.getItem(LEFT_KEY), 'false');
  assert.equal(storage.getItem(RIGHT_KEY), 'true');
  assert.deepEqual(readSidebarVisibility(storage), { left: false, right: true });
});

test('collapsed classes are derived from each sidebar independently', () => {
  assert.equal(sidebarClasses({ left: true, right: true }), 'layout');
  assert.equal(sidebarClasses({ left: false, right: true }), 'layout left-collapsed');
  assert.equal(sidebarClasses({ left: true, right: false }), 'layout right-collapsed');
  assert.equal(sidebarClasses({ left: false, right: false }), 'layout left-collapsed right-collapsed');
});

test('small screens start collapsed without overwriting saved preferences', () => {
  const storage = fakeStorage({ [LEFT_KEY]: 'true', [RIGHT_KEY]: 'true' });
  assert.deepEqual(initialSidebarState(storage, 1440), { left: true, right: true });
  assert.deepEqual(initialSidebarState(storage, 1023), { left: false, right: false });
  assert.equal(storage.getItem(LEFT_KEY), 'true');
  assert.equal(storage.getItem(RIGHT_KEY), 'true');
});

test('unavailable storage never throws', () => {
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(readSidebarVisibility(broken), { left: true, right: true });
  assert.doesNotThrow(() => writeSidebarVisibility(broken, { left: false, right: false }));
});
