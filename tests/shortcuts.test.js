import test from 'node:test';
import assert from 'node:assert/strict';
import { registry } from '../js/registry.js';
import {
  degreeFromState,
  isConfigOperation,
  isTextEntry,
  isPrimaryActionKey,
  isPlaybackShortcut,
  pickPrimaryOperation,
} from '../js/core/shortcuts.js';

function target(tag, attributes = {}) {
  return {
    tag,
    matches(selector) {
      return selector.split(', ').some((part) => part === tag || part === `[contenteditable="${attributes.contenteditable}"]`);
    },
  };
}

test('text entry detection covers fields and editable regions', () => {
  assert.equal(isTextEntry(target('input')), true);
  assert.equal(isTextEntry(target('textarea')), true);
  assert.equal(isTextEntry(target('select')), true);
  assert.equal(isTextEntry(target('div', { contenteditable: 'true' })), true);
  assert.equal(isTextEntry(target('div')), false);
  assert.equal(isTextEntry(null), false);
});

test('Enter in a field is the primary action shortcut', () => {
  assert.equal(isPrimaryActionKey({ key: 'Enter', target: target('input') }), true);
  assert.equal(isPrimaryActionKey({ key: 'Enter', target: target('button') }), false);
  assert.equal(isPrimaryActionKey({ key: 'a', target: target('input') }), false);
  assert.equal(isPrimaryActionKey(null), false);
});

test('Space toggles playback only outside inputs and controls', () => {
  assert.equal(isPlaybackShortcut({ key: ' ', code: 'Space', target: target('body') }), true);
  assert.equal(isPlaybackShortcut({ key: ' ', code: 'Space', target: target('input') }), false);
  assert.equal(isPlaybackShortcut({ key: ' ', code: 'Space', target: target('button') }), false);
  assert.equal(isPlaybackShortcut({ key: 'Enter', target: target('body') }), false);
  assert.equal(isPlaybackShortcut(null), false);
});

test('the current degree is derived from the B-tree order', () => {
  assert.equal(degreeFromState({ order: 8 }), 4);
  assert.equal(degreeFromState({ order: 4 }), 2);
  assert.equal(degreeFromState({}), 2);
});

test('the B-tree degree control stays in the main toolbar', () => {
  assert.equal(isConfigOperation('btree', 'useDegree'), false);
  assert.equal(isConfigOperation('b-plus-tree', 'useDegree'), false);
  assert.equal(isConfigOperation('hash-table', 'useChaining'), true);
  assert.equal(isConfigOperation('graph', 'useDirected'), true);
  assert.equal(isConfigOperation('btree', 'insert'), false);
});

test('Enter picks the insertion action, not reads or configuration setters', () => {
  const primary = (id) => pickPrimaryOperation(registry[id].Structure.meta.operations)?.name;
  assert.equal(primary('stack'), 'push');
  assert.equal(primary('queue'), 'enqueue');
  assert.equal(primary('array'), 'insert');
  assert.equal(primary('hash-table'), 'put');
  assert.equal(primary('bst'), 'insert');
  assert.equal(primary('linked-list'), 'insertHead');
  assert.equal(primary('graph'), 'addVertex');
  assert.equal(pickPrimaryOperation({}), null);
});
