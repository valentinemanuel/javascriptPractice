/** DOM-free helpers for the two collapsible sidebars. */
export const LEFT_KEY = 'structlab.leftSidebar';
export const RIGHT_KEY = 'structlab.rightSidebar';
export const DOCK_KEY = 'structlab.dock';

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

export function readDockVisible(storage) {
  try {
    const raw = storage?.getItem?.(DOCK_KEY);
    return raw === null || raw === undefined ? true : raw !== 'false';
  } catch {
    return true;
  }
}

export function writeDockVisible(storage, visible) {
  try {
    storage?.setItem?.(DOCK_KEY, String(Boolean(visible)));
  } catch {
    // Storage may be disabled; the current session still works.
  }
}

/** Small screens start with both sidebars folded, without overwriting the saved preference. */
export function initialSidebarState(storage, width = 1440) {
  const state = readSidebarVisibility(storage);
  return width < 1024 ? { ...state, left: false, right: false } : state;
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
