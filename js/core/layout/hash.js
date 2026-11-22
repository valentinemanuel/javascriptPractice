/**
 * Grid layout for hash tables.
 *
 * Buckets are placed in a centred grid with enough horizontal room for a
 * collision chain. Chain items sit to the right of their bucket and wrap to a
 * new chain row after three items, keeping long probe trails readable.
 */

const BUCKET_WIDTH = 68;
const ITEMS_PER_ROW = 3;
const ITEM_GAP = 56;
const CHAIN_ROW_HEIGHT = 52;
const BUCKET_OFFSET_X = 62;
const TOP_PADDING = 90;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function compute(state = {}, viewport = {}) {
  const width = viewport.width ?? 900;
  const buckets = asArray(state.buckets);
  const positions = new Map();
  if (buckets.length === 0) return positions;

  const itemsOf = (bucket) => asArray(bucket?.items);
  const maxChain = Math.max(0, ...buckets.map((bucket) => itemsOf(bucket).length));
  const cellWidth = 124 + Math.min(ITEMS_PER_ROW - 1, Math.max(0, maxChain - 1)) * ITEM_GAP;
  const columns = Math.max(1, Math.min(8, Math.floor((width - 60) / cellWidth)));
  const chainRows = Math.ceil(maxChain / ITEMS_PER_ROW);
  const cellHeight = Math.max(112, 64 + chainRows * CHAIN_ROW_HEIGHT);

  const gridWidth = (columns - 1) * cellWidth + BUCKET_WIDTH;
  const startX = Math.max(0, (width - gridWidth) / 2) + BUCKET_WIDTH / 2;

  buckets.forEach((bucket, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const bucketX = startX + column * cellWidth;
    const bucketY = TOP_PADDING + row * cellHeight;
    positions.set(bucket.id, { x: bucketX, y: bucketY });

    itemsOf(bucket).forEach((item, itemIndex) => {
      const chainRow = Math.floor(itemIndex / ITEMS_PER_ROW);
      const chainColumn = itemIndex % ITEMS_PER_ROW;
      positions.set(item.id, {
        x: bucketX + BUCKET_OFFSET_X + chainColumn * ITEM_GAP,
        y: bucketY + chainRow * CHAIN_ROW_HEIGHT,
      });
    });
  });

  return positions;
}
