/** DOM-free helpers for the two collapsible sidebars. */
export const LEFT_KEY = 'structlab.leftSidebar';
export const RIGHT_KEY = 'structlab.rightSidebar';

export function readSidebarVisibility(storage, defaults = { left: true, right: true }) {
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
  };
}

export function writeSidebarVisibility(storage, state) {
  try {
    storage?.setItem?.(LEFT_KEY, String(Boolean(state.left)));
    storage?.setItem?.(RIGHT_KEY, String(Boolean(state.right)));
  } catch {
    // Storage may be disabled; the current session still works.
  }
}

export function sidebarClasses(state) {
  return ['layout', !state.left && 'left-collapsed', !state.right && 'right-collapsed']
    .filter(Boolean)
    .join(' ');
}
