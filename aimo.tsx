'use client';

/**
 * AIMO — a face for your agents.  https://aimo.nrmk.dev
 *
 * Free edition, MIT licensed. Two shapes, an idle face, flat finish.
 * AIMO Pro adds every shape and state, the glass finish and its effects: https://aimo.nrmk.dev/#/pro
 *
 * Generated file — edit it freely in your project, but regenerate rather than patch upstream.
 */

import { useEffect, useRef } from 'react';

type Hsl = { h: number; s: number; l: number };

function hexToHsl(hex: string): Hsl {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0x31c943;
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return { h, s: s * 100, l: l * 100 };
}

type Part =
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'path'; d: string };

type ShapeId = 'ball' | 'square';

type ShapeDef = { id: ShapeId; label: string; parts: Part[]; center: { x: number; y: number } };

const SHAPES: ShapeDef[] = [
  {
    "id": "ball",
    "label": "Ball",
    "center": {
      "x": 180,
      "y": 168
    },
    "parts": [
      {
        "kind": "ellipse",
        "cx": 200,
        "cy": 165,
        "rx": 165,
        "ry": 165
      }
    ]
  },
  {
    "id": "square",
    "label": "Square",
    "center": {
      "x": 180,
      "y": 168
    },
    "parts": [
      {
        "kind": "path",
        "d": "M40 165 C40 60 60 5 200 5 C340 5 360 60 360 165 C360 270 340 325 200 325 C60 325 40 270 40 165 Z"
      }
    ]
  }
];

const DEFAULT_SHAPE: ShapeId = 'ball';
const getShape = (id: ShapeId): ShapeDef => SHAPES.find((s) => s.id === id) ?? SHAPES[0];

type Emotion = 'neutral';
type Eye = { rot: number; curve: number; len: number; w: number; dx: number; dy: number };
type EyePair = { l: Eye; r: Eye };

const EYE_POSES: Record<Emotion, EyePair> = {
  "neutral": {
    "l": {
      "rot": 13,
      "curve": -9,
      "len": 50,
      "w": 31,
      "dx": -30,
      "dy": 0
    },
    "r": {
      "rot": 13,
      "curve": -9,
      "len": 50,
      "w": 31,
      "dx": 30,
      "dy": 0
    }
  }
};

/**
 * The free Avatar: one solid colour, two eyes, a blink and a glance at the pointer.
 *
 * Deliberately a separate renderer from the Pro one rather than a trimmed copy of it. The glossy
 * finish is built out of SVG filter stacks, and a build step that cut them out of the full renderer
 * would leave that code sitting in a file we hand out under MIT — one prop away from being switched
 * back on. Here it simply does not exist.
 *
 * Everything that describes the character — silhouettes, eye geometry, colour maths — comes from
 * `core`, which is shared with Pro and carries no DOM calls, so this renderer stays the only part a
 * React Native or SwiftUI port has to rewrite.
 */

// Same padded box as the Pro renderer: the body lives in 400x330, inset by PAD inside the viewBox.
// Free has no glow to protect, but `size` has to mean the same thing in both so that swapping this
// file for the Pro one never moves anything in a customer's layout.
const PAD = 70;
const BODY_W = 400;
const BODY_H = 330;
const VIEW_W = BODY_W + PAD * 2;
const VIEW_H = BODY_H + PAD * 2;

/** How far the eyes travel toward the pointer, in viewBox units. */
const GAZE_REACH = 22;
const BLINK_MS = 240;
const BLINK_GAP = [2400, 6000] as const;

type Props = {
  /** Body silhouette. */
  shape?: ShapeId;
  /** Body colour; the eyes pick black or white from it for contrast. */
  color?: string;
  /** Rendered width in px. Height follows the 400x330 box. */
  size?: number;
  className?: string;
  /**
   * How far the pointer is noticed, in half body widths. 0 turns the glance off,
   * Infinity follows from anywhere on the page.
   */
  gazeRadius?: number;
  /** True when the face is decoration next to text that already says what it means. */
  decorative?: boolean;
};

const eyePath = (e: Eye) => `M0 ${(-e.len).toFixed(1)} Q${e.curve.toFixed(1)} 0 0 ${e.len.toFixed(1)}`;
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, t);

function Avatar({ shape = DEFAULT_SHAPE, color = '#31c943', size, className, gazeRadius = 1.45, decorative = false }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const leftRef = useRef<SVGGElement>(null);
  const rightRef = useRef<SVGGElement>(null);

  const def = getShape(shape);
  const pose = EYE_POSES.neutral;
  // a light body needs dark eyes to read; anything else takes near-white
  const eyeColor = hexToHsl(color).l > 62 ? '#10131a' : '#f6f7fb';

  const gazeRef = useRef(gazeRadius);
  gazeRef.current = gazeRadius;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pointer = { x: 0, y: 0, seen: false };
    const eyes = { x: 0, y: 0 };
    let blinkStart = -1;
    let nextBlink = performance.now() + BLINK_GAP[0];
    let raf = 0;
    let last = performance.now();
    let visible = true;

    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.seen = true;
    };
    const onLeave = () => {
      pointer.seen = false;
    };

    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(3, (now - last) / 16.67);
      last = now;

      // where the eyes want to be: toward the pointer, but only once it is close enough
      let tx = 0;
      let ty = 0;
      if (pointer.seen && gazeRef.current > 0) {
        const box = svg.getBoundingClientRect();
        const cx = box.left + box.width / 2;
        const cy = box.top + box.height / 2;
        const dx = pointer.x - cx;
        const dy = pointer.y - cy;
        const dist = Math.hypot(dx, dy);
        const reach = (box.width / 2) * gazeRef.current;
        if (gazeRef.current === Infinity || dist < reach) {
          const pull = Math.min(1, dist / (box.width / 2 || 1));
          const len = Math.hypot(dx, dy) || 1;
          tx = (dx / len) * pull * GAZE_REACH;
          ty = (dy / len) * pull * GAZE_REACH * 0.7;
        }
      }
      eyes.x = lerp(eyes.x, tx, reduced ? 1 : 0.12 * dt);
      eyes.y = lerp(eyes.y, ty, reduced ? 1 : 0.12 * dt);
      eyesRef.current?.setAttribute('transform', `translate(${eyes.x.toFixed(2)} ${eyes.y.toFixed(2)})`);

      let squash = 1;
      if (!reduced) {
        if (blinkStart < 0 && now >= nextBlink) blinkStart = now;
        if (blinkStart >= 0) {
          const t = (now - blinkStart) / BLINK_MS;
          if (t >= 1) {
            blinkStart = -1;
            nextBlink = now + BLINK_GAP[0] + Math.random() * (BLINK_GAP[1] - BLINK_GAP[0]);
          } else {
            // down and back up
            squash = Math.abs(Math.cos(t * Math.PI));
          }
        }
      }

      const place = (g: SVGGElement | null, e: Eye) =>
        g?.setAttribute(
          'transform',
          `translate(${(PAD + def.center.x + e.dx).toFixed(1)} ${(PAD + def.center.y + e.dy).toFixed(1)}) rotate(${e.rot}) scale(1 ${squash.toFixed(3)})`,
        );
      place(leftRef.current, pose.l);
      place(rightRef.current, pose.r);

      if (visible && !reduced) raf = requestAnimationFrame(frame);
    };

    // one call settles the pose; it schedules the loop itself when there is motion to run
    frame(performance.now());

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    // stop the loop while the face is scrolled away
    const io =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              visible = entry.isIntersecting;
              if (visible && !raf && !reduced) {
                last = performance.now();
                raf = requestAnimationFrame(frame);
              }
            },
            { rootMargin: '200px' },
          );
    io?.observe(svg);

    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, [def, pose]);

  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width={size}
      height={size ? (size * VIEW_H) / VIEW_W : undefined}
      aria-hidden={decorative ? true : undefined}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'Avatar'}
    >
      <g fill={color} transform={`translate(${PAD} ${PAD})`}>
        {def.parts.map((part, i) =>
          part.kind === 'ellipse' ? (
            <ellipse key={i} cx={part.cx} cy={part.cy} rx={part.rx} ry={part.ry} />
          ) : (
            <path key={i} d={part.d} />
          ),
        )}
      </g>
      <g ref={eyesRef}>
        <g ref={leftRef}>
          <path d={eyePath(pose.l)} stroke={eyeColor} strokeWidth={pose.l.w} strokeLinecap="round" fill="none" />
        </g>
        <g ref={rightRef}>
          <path d={eyePath(pose.r)} stroke={eyeColor} strokeWidth={pose.r.w} strokeLinecap="round" fill="none" />
        </g>
      </g>
    </svg>
  );
}

export { Avatar };
export type { ShapeId, ShapeDef };
