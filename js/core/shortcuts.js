/**
 * Small DOM-agnostic helpers for the application-level keyboard shortcuts.
 * They accept event-like objects so they can be unit tested without a browser.
 */

const TEXT_ENTRY = 'input, textarea, select, [contenteditable="true"]';
const INTERACTIVE = 'button, a, summary, [role="button"]';

function matches(target, selector) {
  return Boolean(target && typeof target.matches === 'function' && target.matches(selector));
}

export function isTextEntry(target) {
  return matches(target, TEXT_ENTRY);
}

/** Enter inside an argument field triggers the structure's primary operation. */
export function isPrimaryActionKey(event) {
  return Boolean(event) && event.key === 'Enter' && isTextEntry(event.target);
}

/** Space toggles playback only when focus is outside any control. */
export function isPlaybackShortcut(event) {
  if (!event || (event.key !== ' ' && event.code !== 'Space')) return false;
  return !isTextEntry(event.target) && !matches(event.target, INTERACTIVE);
}

/** Config setters live in the accordion, except the B-tree degree control. */
export function isConfigOperation(id, name) {
  const isSetting = name.startsWith('use') || name.startsWith('new');
  const isTreeDegree = (id === 'btree' || id === 'b-plus-tree') && name === 'useDegree';
  return isSetting && !isTreeDegree;
}

/** Chooses the insertion-style operation that Enter runs for a structure. */
export function pickPrimaryOperation(operations = {}) {
  const candidates = Object.entries(operations)
    .filter(([name, operation]) => !name.startsWith('use')
      && !name.startsWith('new')
      && (operation?.fields ?? []).length > 0)
    .map(([name, operation]) => ({ name, operation }));

  const insertionVerbs = ['push', 'enqueue', 'insert', 'put', 'add'];
  return insertionVerbs
    .map((verb) => candidates.find((candidate) => candidate.name.toLowerCase().startsWith(verb)))
    .find(Boolean) ?? candidates[0] ?? null;
}
