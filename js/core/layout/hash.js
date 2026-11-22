/**
 * Textbook hash diagram: keys on the left, a hash-function box in the middle
 * and an Index / Value table on the right. The table makes occupied, empty and
 * tombstone slots explicit.
 */

const KEY_WIDTH = 104;
const KEY_HEIGHT = 36;
const HASH_WIDTH = 240;
const HASH_HEIGHT = 78;
const INDEX_COLUMN = 72;
const TOP = 104;
const BOTTOM_GAP = 40;
const KEY_X = 116;

export function compute(state = {}, viewport = {}) {
  const width = viewport.width ?? 900;
  const height = viewport.height ?? 560;
  const buckets = Array.isArray(state.buckets) ? state.buckets : [];
  const positions = new Map();
  if (buckets.length === 0) return positions;

  const chaining = state.strategy === 'chaining';
  const tableWidth = chaining
    ? Math.min(240, Math.max(200, width * 0.26))
    : Math.min(280, Math.max(210, width * 0.3));
  const chainArea = chaining ? 150 : 0;
  const tableLeft = Math.max(
    KEY_X + KEY_WIDTH + 150,
    width - tableWidth - chainArea - 40,
  );
  const hashX = (KEY_X + KEY_WIDTH / 2 + tableLeft) / 2;
  const hashY = TOP + Math.min(96, (height - TOP - BOTTOM_GAP) * 0.34);

  const rowHeight = Math.max(19, Math.min(36, (height - TOP - BOTTOM_GAP) / buckets.length));
  const tableHeight = rowHeight * buckets.length;
  const tableTop = TOP;

  positions.set('__hash', {
    x: hashX,
    y: hashY,
    width: HASH_WIDTH,
    height: HASH_HEIGHT,
  });
  positions.set('__table', {
    x: tableLeft,
    y: tableTop,
    width: tableWidth,
    height: tableHeight,
    indexWidth: INDEX_COLUMN,
    rowHeight,
  });
  positions.set('__keys', { x: KEY_X, y: tableTop, width: KEY_WIDTH });
  positions.set('__input', { x: KEY_X, y: 46, width: KEY_WIDTH + 44, height: 34 });
  positions.set('__chain', {
    x: tableLeft + tableWidth + 28,
    step: 46,
    max: 3,
  });

  buckets.forEach((bucket, index) => {
    positions.set(bucket.id, {
      x: tableLeft + tableWidth / 2,
      y: tableTop + rowHeight * (index + 0.5),
      width: tableWidth,
      height: rowHeight,
      index,
    });
  });

  const keys = buckets.flatMap((bucket) => bucket.items ?? []);
  const keyStep = Math.max(30, Math.min(44, (height - TOP - BOTTOM_GAP) / Math.max(1, keys.length)));
  keys.forEach((item, index) => {
    positions.set(item.id, {
      x: KEY_X,
      y: TOP + 18 + index * keyStep,
      width: KEY_WIDTH,
      height: KEY_HEIGHT,
    });
  });

  return positions;
}
