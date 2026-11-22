import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CENTER_KEY,
  LEFT_KEY,
  RIGHT_KEY,
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
  assert.deepEqual(readSidebarVisibility(null), { left: true, right: true, center: true });
  assert.deepEqual(readSidebarVisibility(fakeStorage()), { left: true, right: true, center: true });
  assert.deepEqual(
    readSidebarVisibility(fakeStorage({
      [LEFT_KEY]: 'false',
      [RIGHT_KEY]: 'true',
      [CENTER_KEY]: 'false',
    })),
    { left: false, right: true, center: false },
  );
});

test('sidebar visibility is persisted and restored independently', () => {
  const storage = fakeStorage();
  writeSidebarVisibility(storage, { left: false, right: true, center: false });
  assert.equal(storage.getItem(LEFT_KEY), 'false');
  assert.equal(storage.getItem(RIGHT_KEY), 'true');
  assert.equal(storage.getItem(CENTER_KEY), 'false');
  assert.deepEqual(readSidebarVisibility(storage), { left: false, right: true, center: false });
});

test('collapsed classes are derived from each sidebar independently', () => {
  assert.equal(sidebarClasses({ left: true, right: true, center: true }), 'layout');
  assert.equal(sidebarClasses({ left: false, right: true, center: true }), 'layout left-collapsed');
  assert.equal(sidebarClasses({ left: true, right: false, center: true }), 'layout right-collapsed');
  assert.equal(sidebarClasses({ left: false, right: false, center: true }), 'layout left-collapsed right-collapsed');
  assert.equal(sidebarClasses({ left: true, right: true, center: false }), 'layout center-collapsed');
});

test('unavailable storage never throws', () => {
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(readSidebarVisibility(broken), { left: true, right: true, center: true });
  assert.doesNotThrow(() => writeSidebarVisibility(broken, { left: false, right: false, center: false }));
});
