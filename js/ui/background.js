/**
 * Antigravity-style interactive background: a uniform particle grid that
 * reacts to the pointer plus a faint radial glow that follows the mouse.
 * It lives in its own canvas behind the UI and never touches the structure SVG.
 */

const GRID_SPACING = 34;
const INTERACTION_RADIUS = 160;
const MAX_OFFSET = 18;
const MOUSE_LERP = 0.09;
const POSITION_LERP = 0.12;
const STYLE_LERP = 0.12;
const GLOW_RADIUS = 340;

const PALETTES = {
  dark: {
    point: [150, 180, 215],
    glow: [88, 166, 255],
    glowAlpha: 0.1,
    baseAlpha: 0.2,
  },
  light: {
    point: [90, 110, 140],
    glow: [9, 105, 218],
    glowAlpha: 0.07,
    baseAlpha: 0.18,
  },
};

function currentTheme() {
  const declared = document.documentElement.dataset.theme;
  if (declared === 'dark' || declared === 'light') return declared;
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

/**
 * Mounts the background canvas and returns a teardown function.
 * @returns {() => void}
 */
export function initBackground() {
  const canvas = document.createElement('canvas');
  canvas.id = 'bg-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) return () => canvas.remove();

  let palette = PALETTES[currentTheme()];
  let width = 0;
  let height = 0;
  let particles = [];
  let frame = 0;
  const motionQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  let reducedMotion = motionQuery?.matches ?? false;
  const mouse = { x: -1000, y: -1000, targetX: -1000, targetY: -1000 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const columns = Math.ceil(width / GRID_SPACING) + 1;
    const rows = Math.ceil(height / GRID_SPACING) + 1;
    const offsetX = (width - (columns - 1) * GRID_SPACING) / 2;
    const offsetY = (height - (rows - 1) * GRID_SPACING) / 2;

    particles = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = offsetX + column * GRID_SPACING;
        const y = offsetY + row * GRID_SPACING;
        particles.push({
          baseX: x,
          baseY: y,
          x,
          y,
          radius: 1.25,
          alpha: palette.baseAlpha,
        });
      }
    }
    if (reducedMotion) draw();
  }

  function update() {
    mouse.x += (mouse.targetX - mouse.x) * MOUSE_LERP;
    mouse.y += (mouse.targetY - mouse.y) * MOUSE_LERP;

    for (const particle of particles) {
      const dx = particle.baseX - mouse.x;
      const dy = particle.baseY - mouse.y;
      const distance = Math.hypot(dx, dy);
      const influence = Math.max(0, 1 - distance / INTERACTION_RADIUS);
      const eased = influence * influence;

      let targetX = particle.baseX;
      let targetY = particle.baseY;
      if (eased > 0 && distance > 0.001) {
        targetX += (dx / distance) * MAX_OFFSET * eased;
        targetY += (dy / distance) * MAX_OFFSET * eased;
      }

      particle.x += (targetX - particle.x) * POSITION_LERP;
      particle.y += (targetY - particle.y) * POSITION_LERP;
      particle.radius += (1.25 + eased * 1.8 - particle.radius) * STYLE_LERP;
      particle.alpha += (palette.baseAlpha + eased * 0.45 - particle.alpha) * STYLE_LERP;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    const [glowR, glowG, glowB] = palette.glow;
    const gradient = ctx.createRadialGradient(
      mouse.x, mouse.y, 0,
      mouse.x, mouse.y, GLOW_RADIUS,
    );
    gradient.addColorStop(0, `rgba(${glowR}, ${glowG}, ${glowB}, ${palette.glowAlpha})`);
    gradient.addColorStop(1, `rgba(${glowR}, ${glowG}, ${glowB}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const [pointR, pointG, pointB] = palette.point;
    for (const particle of particles) {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${pointR}, ${pointG}, ${pointB}, ${particle.alpha})`;
      ctx.fill();
    }
  }

  function loop() {
    update();
    draw();
    frame = window.requestAnimationFrame(loop);
  }

  function onMouseMove(event) {
    mouse.targetX = event.clientX;
    mouse.targetY = event.clientY;
    if (reducedMotion) {
      mouse.x = mouse.targetX;
      mouse.y = mouse.targetY;
      draw();
    }
  }

  function onThemeChange() {
    palette = PALETTES[currentTheme()] ?? PALETTES.dark;
    if (reducedMotion) draw();
  }

  function onMotionChange(event) {
    reducedMotion = Boolean(event.matches);
    if (reducedMotion) {
      window.cancelAnimationFrame(frame);
      frame = 0;
      draw();
      return;
    }
    if (!frame) frame = window.requestAnimationFrame(loop);
  }

  const observer = typeof MutationObserver === 'function'
    ? new MutationObserver(onThemeChange)
    : null;
  if (observer) {
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }
  if (motionQuery?.addEventListener) {
    motionQuery.addEventListener('change', onMotionChange);
  } else if (motionQuery?.addListener) {
    motionQuery.addListener(onMotionChange);
  }

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', onMouseMove, { passive: true });

  if (reducedMotion) {
    draw();
  } else {
    frame = window.requestAnimationFrame(loop);
  }

  return () => {
    window.cancelAnimationFrame(frame);
    window.removeEventListener('resize', resize);
    window.removeEventListener('mousemove', onMouseMove);
    if (motionQuery?.removeEventListener) {
      motionQuery.removeEventListener('change', onMotionChange);
    } else if (motionQuery?.removeListener) {
      motionQuery.removeListener(onMotionChange);
    }
    observer?.disconnect();
    canvas.remove();
  };
}
