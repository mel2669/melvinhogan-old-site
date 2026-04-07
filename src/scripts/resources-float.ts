/**
 * Slow perpetual 2D float for resource links: velocity integration, circle collisions,
 * wall bounces. Tuned for calm motion (animations.dev-style: smooth, no harsh linear feel).
 */

const RESTITUTION_PAIR = 0.92;
const RESTITUTION_WALL = 0.96;
const MAX_DT = 1 / 30;
const SUBSTEPS = 2;
const SPEED_MIN = 18;
const SPEED_MAX = 52;
/** Tiny tangential jitter after pair collision so paths don’t lock into repeating cycles */
const TANGENT_JITTER = 0.35;

export type ResourcesFloatOptions = {
  /** Called when physics is skipped (e.g. reduced motion) */
  onStaticLayout?: () => void;
};

type Body = {
  el: HTMLElement;
  cx: number;
  cy: number;
  vx: number;
  vy: number;
  r: number;
  w: number;
  h: number;
};

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function randomSpeed(): number {
  return SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
}

function randomAngle(): number {
  return Math.random() * Math.PI * 2;
}

function circleRadiusForRect(w: number, h: number): number {
  return (Math.hypot(w, h) / 2) * 0.92;
}

function placeBodiesNonOverlapping(
  bodies: Body[],
  aw: number,
  ah: number
): void {
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i]!;
    let placed = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      b.cx = b.r + Math.random() * Math.max(1, aw - 2 * b.r);
      b.cy = b.r + Math.random() * Math.max(1, ah - 2 * b.r);
      let ok = true;
      for (let j = 0; j < i; j++) {
        const o = bodies[j]!;
        const dx = b.cx - o.cx;
        const dy = b.cy - o.cy;
        const minDist = b.r + o.r + 4;
        if (dx * dx + dy * dy < minDist * minDist) {
          ok = false;
          break;
        }
      }
      if (ok) {
        placed = true;
        break;
      }
    }
    if (!placed) {
      b.cx = aw / 2 + (i % 3) * 40;
      b.cy = ah / 2 + Math.floor(i / 3) * 40;
    }
  }
}

function resolvePair(a: Body, b: Body): void {
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const dist = Math.hypot(dx, dy) || 1e-6;
  const minDist = a.r + b.r;
  if (dist >= minDist) return;

  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = minDist - dist;
  const push = overlap * 0.51;
  a.cx -= nx * push;
  a.cy -= ny * push;
  b.cx += nx * push;
  b.cy += ny * push;

  const dvx = a.vx - b.vx;
  const dvy = a.vy - b.vy;
  const velAlongN = dvx * nx + dvy * ny;
  if (velAlongN > 0) return;

  const j = (-(1 + RESTITUTION_PAIR) * velAlongN) / 2;
  const ix = j * nx;
  const iy = j * ny;
  a.vx += ix;
  a.vy += iy;
  b.vx -= ix;
  b.vy -= iy;

  const tx = -ny;
  const ty = nx;
  const jitter = (Math.random() - 0.5) * TANGENT_JITTER;
  a.vx += tx * jitter;
  a.vy += ty * jitter;
  b.vx -= tx * jitter * 0.5;
  b.vy -= ty * jitter * 0.5;
}

function resolveWalls(b: Body, aw: number, ah: number): void {
  if (b.cx - b.r < 0) {
    b.cx = b.r;
    b.vx = Math.abs(b.vx) * RESTITUTION_WALL;
  } else if (b.cx + b.r > aw) {
    b.cx = aw - b.r;
    b.vx = -Math.abs(b.vx) * RESTITUTION_WALL;
  }
  if (b.cy - b.r < 0) {
    b.cy = b.r;
    b.vy = Math.abs(b.vy) * RESTITUTION_WALL;
  } else if (b.cy + b.r > ah) {
    b.cy = ah - b.r;
    b.vy = -Math.abs(b.vy) * RESTITUTION_WALL;
  }
}

function applyTransforms(bodies: Body[]): void {
  for (const b of bodies) {
    const x = b.cx - b.w / 2;
    const y = b.cy - b.h / 2;
    b.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }
}

export function initResourcesFloat(
  arena: HTMLElement,
  options?: ResourcesFloatOptions
): (() => void) | void {
  const buttons = Array.from(arena.querySelectorAll<HTMLElement>(".resources-float-btn"));
  if (buttons.length === 0) return;

  if (prefersReducedMotion()) {
    arena.classList.add("resources-arena--static");
    buttons.forEach((el) => {
      el.style.transform = "";
    });
    options?.onStaticLayout?.();
    return;
  }

  arena.classList.remove("resources-arena--static");

  let pointerX: number | null = null;
  let pointerY: number | null = null;

  const syncPointer = (e: PointerEvent): void => {
    pointerX = e.clientX;
    pointerY = e.clientY;
  };

  document.addEventListener("pointermove", syncPointer, { passive: true });
  document.addEventListener("pointerdown", syncPointer, { passive: true });
  document.addEventListener("pointerup", syncPointer, { passive: true });

  function pointerOverAnyChip(): boolean {
    if (pointerX == null || pointerY == null) return false;
    for (const node of document.elementsFromPoint(pointerX, pointerY)) {
      if (!(node instanceof Element)) continue;
      const chip = node.closest(".resources-float-btn");
      if (chip instanceof HTMLElement && buttons.includes(chip)) return true;
    }
    return false;
  }

  const bodies: Body[] = buttons.map((el) => {
    const r = el.getBoundingClientRect();
    const w = r.width;
    const h = r.height;
    const rad = circleRadiusForRect(w, h);
    const sp = randomSpeed();
    const ang = randomAngle();
    return {
      el,
      cx: 0,
      cy: 0,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      r: rad,
      w,
      h,
    };
  });

  let aw = 0;
  let ah = 0;

  function measure(): void {
    const ar = arena.getBoundingClientRect();
    aw = ar.width;
    ah = ar.height;
    for (const b of bodies) {
      const r = b.el.getBoundingClientRect();
      b.w = r.width;
      b.h = r.height;
      b.r = circleRadiusForRect(b.w, b.h);
    }
    placeBodiesNonOverlapping(bodies, aw, ah);
    applyTransforms(bodies);
  }

  let raf = 0;
  let last = performance.now();

  function tick(now: number): void {
    let dt = Math.min(MAX_DT, (now - last) / 1000);
    last = now;
    if (dt <= 0) dt = 1 / 60;

    if (pointerOverAnyChip()) {
      raf = requestAnimationFrame(tick);
      return;
    }

    const sub = dt / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) {
      for (const b of bodies) {
        b.cx += b.vx * sub;
        b.cy += b.vy * sub;
        resolveWalls(b, aw, ah);
      }
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          resolvePair(bodies[i]!, bodies[j]!);
        }
      }
    }

    applyTransforms(bodies);
    raf = requestAnimationFrame(tick);
  }

  const ro = new ResizeObserver(() => {
    measure();
  });
  ro.observe(arena);

  function startLoop(): void {
    measure();
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  /* Two rAFs so button sizes / arena box are settled after styles and fonts */
  requestAnimationFrame(() => {
    requestAnimationFrame(startLoop);
  });

  const cleanup = (): void => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    document.removeEventListener("pointermove", syncPointer);
    document.removeEventListener("pointerdown", syncPointer);
    document.removeEventListener("pointerup", syncPointer);
    buttons.forEach((el) => {
      el.style.transform = "";
    });
  };

  window.addEventListener("pagehide", cleanup, { once: true });
  return cleanup;
}
