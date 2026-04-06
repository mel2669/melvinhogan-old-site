/**
 * Gentle 2D drift with circle-circle collisions inside each stage.
 * Pauses physics while the pointer is over a chip (elementsFromPoint) or the link is focused.
 */

type Body = {
  el: HTMLAnchorElement;
  cx: number;
  cy: number;
  vx: number;
  vy: number;
  r: number;
  w: number;
  h: number;
};

let pointerX: number | null = null;
let pointerY: number | null = null;
let pointerListenersAttached = false;

function attachGlobalPointerListeners(): void {
  if (pointerListenersAttached) return;
  pointerListenersAttached = true;
  const sync = (e: PointerEvent) => {
    pointerX = e.clientX;
    pointerY = e.clientY;
  };
  document.addEventListener("pointermove", sync, { passive: true });
  document.addEventListener("pointerdown", sync, { passive: true });
}

function getHoveredFloatLink(): HTMLAnchorElement | null {
  if (pointerX == null || pointerY == null) return null;
  const stack = document.elementsFromPoint(pointerX, pointerY);
  const el = stack.find(
    (n): n is HTMLAnchorElement =>
      n instanceof HTMLAnchorElement && n.classList.contains("resources-float-link"),
  );
  return el ?? null;
}

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

function initStage(stage: HTMLElement): (() => void) | void {
  const links = [...stage.querySelectorAll<HTMLAnchorElement>(".resources-float-link")];
  if (links.length === 0) return;

  const bodies: Body[] = [];
  let stageW = 1;
  let stageH = 1;

  function measureStage() {
    const rect = stage.getBoundingClientRect();
    stageW = Math.max(1, rect.width);
    stageH = Math.max(1, rect.height);
  }

  measureStage();

  for (const el of links) {
    el.style.position = "absolute";
    el.style.left = "0";
    el.style.top = "0";
    el.style.willChange = "transform";
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const r = Math.hypot(w, h) / 2;
    const speed = 16 + Math.random() * 20;
    const angle = Math.random() * Math.PI * 2;
    bodies.push({
      el,
      cx: 0,
      cy: 0,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r,
      w,
      h,
    });
  }

  for (const b of bodies) {
    b.cx = b.r + Math.random() * Math.max(1, stageW - 2 * b.r);
    b.cy = b.r + Math.random() * Math.max(1, stageH - 2 * b.r);
  }

  function resolvePair(a: Body, b: Body, aPaused: boolean, bPaused: boolean) {

    const dx = b.cx - a.cx;
    const dy = b.cy - a.cy;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const minD = a.r + b.r;
    if (dist >= minD) return;
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minD - dist + 0.75;

    const v1n = a.vx * nx + a.vy * ny;
    const v2n = b.vx * nx + b.vy * ny;

    if (!aPaused && !bPaused) {
      a.cx -= nx * (overlap * 0.5);
      a.cy -= ny * (overlap * 0.5);
      b.cx += nx * (overlap * 0.5);
      b.cy += ny * (overlap * 0.5);
      if (v1n - v2n < 0) {
        a.vx += (v2n - v1n) * nx;
        a.vy += (v2n - v1n) * ny;
        b.vx += (v1n - v2n) * nx;
        b.vy += (v1n - v2n) * ny;
      }
    } else if (aPaused && !bPaused) {
      b.cx += nx * overlap;
      b.cy += ny * overlap;
      const vn = v2n;
      if (vn < 0) {
        b.vx -= 2 * vn * nx;
        b.vy -= 2 * vn * ny;
      }
    } else if (!aPaused && bPaused) {
      a.cx -= nx * overlap;
      a.cy -= ny * overlap;
      const vn = v1n;
      if (vn > 0) {
        a.vx -= 2 * vn * nx;
        a.vy -= 2 * vn * ny;
      }
    }
  }

  function wallBounce(b: Body, paused: boolean) {
    if (paused) return;
    let { cx, cy, vx, vy, r } = b;
    if (cx - r < 0) {
      cx = r;
      vx = Math.abs(vx) * 0.985;
    }
    if (cx + r > stageW) {
      cx = stageW - r;
      vx = -Math.abs(vx) * 0.985;
    }
    if (cy - r < 0) {
      cy = r;
      vy = Math.abs(vy) * 0.985;
    }
    if (cy + r > stageH) {
      cy = stageH - r;
      vy = -Math.abs(vy) * 0.985;
    }
    b.cx = cx;
    b.cy = cy;
    b.vx = vx;
    b.vy = vy;
  }

  const ro = new ResizeObserver(() => measureStage());
  ro.observe(stage);

  let last = performance.now();
  let raf = 0;

  function tick(now: number) {
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    measureStage();

    const substeps = 4;
    const sdt = dt / substeps;
    for (let s = 0; s < substeps; s++) {
      const hoveredLink = getHoveredFloatLink();
      const pausedFlags = bodies.map(
        (b) => document.activeElement === b.el || hoveredLink === b.el,
      );
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        const paused = pausedFlags[i];
        if (paused) {
          b.vx = 0;
          b.vy = 0;
        } else {
          b.cx += b.vx * sdt;
          b.cy += b.vy * sdt;
        }
        wallBounce(b, paused);
      }
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          resolvePair(bodies[i], bodies[j], pausedFlags[i], pausedFlags[j]);
        }
      }
    }

    for (const b of bodies) {
      const x = b.cx - b.w / 2;
      const y = b.cy - b.h / 2;
      b.el.style.transform = `translate(${x}px, ${y}px)`;
    }

    raf = requestAnimationFrame(tick);
  }

  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
  };
}

export function initResourcesFloat(): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.documentElement.classList.add("resources-float-static");
    return;
  }

  attachGlobalPointerListeners();

  const stages = [...document.querySelectorAll<HTMLElement>("[data-resources-float]")];
  const cleanups: (void | (() => void))[] = [];
  for (const stage of stages) {
    cleanups.push(initStage(stage));
  }

  window.addEventListener(
    "pagehide",
    () => {
      for (const c of cleanups) {
        if (typeof c === "function") c();
      }
    },
    { once: true },
  );
}
