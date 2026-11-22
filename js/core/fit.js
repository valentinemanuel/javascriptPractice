/**
 * Computes the translate/scale needed to centre an SVG bounding box in the
 * available drawing area. Pure so it can be tested without a DOM.
 */
export function computeFitTransform(box, viewport) {
  const width = box?.width ?? 0;
  const height = box?.height ?? 0;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  const areaWidth = Math.max(80, (viewport.width ?? 900) - 32);
  const areaHeight = Math.max(80, (viewport.bottom ?? 560) - (viewport.top ?? 0) - 16);
  const maxScale = viewport.maxScale ?? 1.35;
  const scale = Math.min(maxScale, areaWidth / width, areaHeight / height);
  const safeScale = Math.max(0.15, scale);

  const centerX = box.x + width / 2;
  const centerY = box.y + height / 2;

  return {
    scale: safeScale,
    translateX: (viewport.width ?? 900) / 2 - centerX * safeScale,
    translateY: (viewport.top ?? 0) + areaHeight / 2 - centerY * safeScale,
  };
}
