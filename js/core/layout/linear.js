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

  const startX = vertical
    ? width / 2
    : Math.max(70, (width - (items.length - 1) * gap) / 2);
  const startY = vertical ? height - 70 : height / 2;

  items.forEach((item, index) => {
    positions.set(item.id, {
      x: vertical ? startX : startX + index * gap,
      y: vertical ? startY - index * gap : startY,
      index,
    });
  });

  return positions;
}
