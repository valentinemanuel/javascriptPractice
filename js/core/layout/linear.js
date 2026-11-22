/**
 * Row / column positions for stacks, queues, arrays and linked lists.
 */
export function compute(state, viewport = {}) {
  const width = viewport.width ?? 900;
  const height = viewport.height ?? 560;
  const items = state.nodes ?? state.items ?? [];
  const vertical = state.orientation === 'vertical';
  const gap = vertical ? 58 : 78;
  const positions = new Map();

  // Arrays reserve capacity beyond their current size, so centre the whole strip.
  const capacity = Number.isInteger(state.capacity) ? state.capacity : 0;
  const isArray = capacity > 0 && Array.isArray(state.items) && state.head === undefined;
  const slots = isArray ? Math.max(items.length, capacity) : items.length;

  const startX = vertical
    ? width / 2
    : Math.max(70, (width - (slots - 1) * gap) / 2);
  const startY = vertical ? height - 70 : height / 2;

  items.forEach((item, index) => {
    positions.set(item.id, {
      x: vertical ? startX : startX + index * gap,
      y: vertical ? startY - index * gap : startY,
      index,
      ...(vertical ? {} : { width: gap, height: 50 }),
    });
  });

  if (isArray) {
    for (let index = items.length; index < capacity; index += 1) {
      positions.set(`__free-${index}`, {
        x: startX + index * gap,
        y: startY,
        index,
        width: gap,
        height: 50,
        free: true,
      });
    }
  }

  return positions;
}
