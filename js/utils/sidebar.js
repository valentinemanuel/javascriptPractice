/** DOM-free helpers for the two collapsible sidebars. */
export const LEFT_KEY = 'structlab.leftSidebar';
export const RIGHT_KEY = 'structlab.rightSidebar';
export const CENTER_KEY = 'structlab.centerPanel';

export function readSidebarVisibility(storage, defaults = { left: true, right: true, center: true }) {
  const read = (key, fallback) => {
    try {
      const raw = storage?.getItem?.(key);
      if (raw === null || raw === undefined) return fallback;
      return raw !== 'false';
    } catch {
      return fallback;
    }
  };
  return {
    left: read(LEFT_KEY, defaults.left ?? true),
    right: read(RIGHT_KEY, defaults.right ?? true),
    center: read(CENTER_KEY, defaults.center ?? true),
  };
}

export function writeSidebarVisibility(storage, state) {
  try {
    storage?.setItem?.(LEFT_KEY, String(Boolean(state.left)));
    storage?.setItem?.(RIGHT_KEY, String(Boolean(state.right)));
    storage?.setItem?.(CENTER_KEY, String(Boolean(state.center)));
  } catch {
    // Storage may be disabled; the current session still works.
  }
}

export function sidebarClasses(state) {
  return [
    'layout',
    !state.left && 'left-collapsed',
    !state.right && 'right-collapsed',
    !state.center && 'center-collapsed',
  ].filter(Boolean).join(' ');
}
