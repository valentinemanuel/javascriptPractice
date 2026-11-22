/**
 * Hash table layout inspired by textbook diagrams:
 * an array of indexed slots, with linked-list chains extending to the right
 * when separate chaining is selected. Open-addressing keys live inside slots.
 */

const SLOT_WIDTH = 92;
const SLOT_HEIGHT = 54;
const TOP_PADDING = 86;
const CHAIN_ROW_HEIGHT = 44;
const CHAIN_COLUMN_GAP = 44;
const CHAIN_ITEMS_PER_ROW = 3;

export function compute(state = {}, viewport = {}) {
  const width = viewport.width ?? 900;
  const buckets = Array.isArray(state.buckets) ? state.buckets : [];
  const positions = new Map();
  if (buckets.length === 0) return positions;

  const chaining = state.strategy === 'chaining';
  const usableWidth = Math.max(200, width - 140);
  const minimumGap = chaining ? 210 : 120;
  const columns = Math.max(1, Math.min(buckets.length, Math.floor(usableWidth / minimumGap) + 1));
  const columnGap = columns > 1 ? usableWidth / (columns - 1) : 0;
  const rowHeight = chaining ? 134 : 92;
  const startX = width / 2 - ((columns - 1) * columnGap) / 2;

  buckets.forEach((bucket, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = startX + column * columnGap;
    const y = TOP_PADDING + row * rowHeight + SLOT_HEIGHT / 2;

    positions.set(bucket.id, {
      x,
      y,
      width: SLOT_WIDTH,
      height: SLOT_HEIGHT,
      index,
    });

    const items = Array.isArray(bucket.items) ? bucket.items : [];
    items.forEach((item, itemIndex) => {
      if (!chaining) {
        positions.set(item.id, { x, y, width: SLOT_WIDTH, height: SLOT_HEIGHT });
        return;
      }
      const chainRow = Math.floor(itemIndex / CHAIN_ITEMS_PER_ROW);
      const chainColumn = itemIndex % CHAIN_ITEMS_PER_ROW;
      positions.set(item.id, {
        x: x + SLOT_WIDTH / 2 + 26
          + chainColumn * CHAIN_COLUMN_GAP + chainRow * CHAIN_COLUMN_GAP,
        y: y + chainRow * CHAIN_ROW_HEIGHT,
        radius: 19,
      });
    });
  });

  return positions;
}
