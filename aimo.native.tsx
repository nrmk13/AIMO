/**
 * AIMO — a face for your agents.  https://aimo.nrmk.dev
 *
 * Free edition for React Native, MIT licensed. Two shapes, an idle face, flat finish. Drawn with Skia:
 *
 *   npx expo install @shopify/react-native-skia react-native-reanimated react-native-worklets
 *
 * AIMO Pro adds every shape and state, the glass finish and its effects: https://aimo.nrmk.dev/#/pro
 *
 * Generated file — edit it freely in your project, but regenerate rather than patch upstream.
 */

import { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, AppState, type StyleProp, type ViewStyle } from 'react-native';
import { Canvas, PaintStyle, PathOp, Picture, Skia, type SkPath, type SkPicture, StrokeCap } from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';

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
 * The free Avatar for React Native: one solid colour, two eyes, a blink and a glance toward
 * `lookAt`. The twin of the web `Avatar.tsx`, drawn with Skia, with the same props as the Pro
 * native file so upgrading is swapping the file.
 *
 *   npx expo install @shopify/react-native-skia react-native-reanimated react-native-worklets
 */

// Same padded box as every other renderer, so `size` means the same thing in all of them.
const PAD = 70;
const BODY_W = 400;
const BODY_H = 330;
const VIEW_W = BODY_W + PAD * 2;
const VIEW_H = BODY_H + PAD * 2;

/** How far the eyes travel toward `lookAt`, in viewBox units. */
const GAZE_REACH = 22;
const BLINK_MS = 240;
const BLINK_GAP = [2400, 6000] as const;

type Props = {
  shape?: ShapeId;
  /** Body colour; the eyes pick black or white from it for contrast. */
  color?: string;
  /** Rendered width in points (default 96). */
  size?: number;
  /** A point to glance at, in points from the avatar's top-left corner. */
  lookAt?: { x: number; y: number } | null;
  /** Hide it from screen readers when adjacent text already says what it means. */
  decorative?: boolean;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

const eyePath = (e: Eye) => `M0 ${(-e.len).toFixed(1)} Q${e.curve.toFixed(1)} 0 0 ${e.len.toFixed(1)}`;
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, t);

// React Native has `performance.now()` (and stamps requestAnimationFrame with it) but its type
// definitions do not declare it, so it is declared here for this module only.
declare const performance: { now(): number } | undefined;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * The canvas needs a picture before the first frame is drawn. A recorder has to begin before it can
 * finish (finishing one that never began crashes natively), and one blank picture serves every
 * instance, so it is made once.
 */
let blank: SkPicture | null = null;
function blankPicture(): SkPicture {
  if (!blank) {
    const rec = Skia.PictureRecorder();
    rec.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
    blank = rec.finishRecordingAsPicture();
  }
  return blank;
}

function Avatar({ shape = DEFAULT_SHAPE, color = '#31c943', size = 96, lookAt = null, decorative = false, label = 'Avatar', style }: Props) {
  const def = getShape(shape);
  const pose = EYE_POSES.neutral;

  const scene = useMemo(() => {
    // parts are unioned, so two overlapping ones cannot cut a hole in each other
    let body: SkPath | null = null;
    for (const part of def.parts) {
      const d =
        part.kind === 'ellipse'
          ? `M${part.cx - part.rx} ${part.cy} A${part.rx} ${part.ry} 0 1 0 ${part.cx + part.rx} ${part.cy} A${part.rx} ${part.ry} 0 1 0 ${part.cx - part.rx} ${part.cy} Z`
          : part.d;
      const p = Skia.Path.MakeFromSVGString(d);
      if (p) body = body ? (Skia.Path.MakeFromOp(body, p, PathOp.Union) ?? body) : p;
    }
    const fill = Skia.Paint();
    fill.setAntiAlias(true);
    fill.setColor(Skia.Color(color));
    const eye = Skia.Paint();
    eye.setAntiAlias(true);
    eye.setStyle(PaintStyle.Stroke);
    eye.setStrokeCap(StrokeCap.Round);
    // a light body needs dark eyes to read; anything else takes near-white
    eye.setColor(Skia.Color(hexToHsl(color).l > 62 ? '#10131a' : '#f6f7fb'));
    return { body: body ?? Skia.Path.Make(), fill, eye, left: Skia.Path.MakeFromSVGString(eyePath(pose.l)), right: Skia.Path.MakeFromSVGString(eyePath(pose.r)) };
  }, [def, color, pose]);

  const picture = useSharedValue<SkPicture>(blankPicture());
  const live = useRef({ scene, size, lookAt });
  live.current = { scene, size, lookAt };

  useEffect(() => {
    const look = { x: 0, y: 0 };
    let blinkStart = -1;
    let nextBlink = now() + BLINK_GAP[0];
    let raf = 0;
    let last = now();
    let reduced = false;
    let active = AppState.currentState === 'active';

    const frame = (t: number) => {
      raf = 0;
      const { scene: s, size: w, lookAt: target } = live.current;
      const dt = Math.min(3, (t - last) / 16.67);
      last = t;

      // toward the target, scaled by how far it is, the way the web face glances at the pointer
      let tx = 0;
      let ty = 0;
      if (target) {
        const dx = target.x - w / 2;
        const dy = target.y - (w * VIEW_H) / VIEW_W / 2;
        const dist = Math.hypot(dx, dy) || 1;
        const pull = Math.min(1, dist / (w / 2 || 1));
        tx = (dx / dist) * pull * GAZE_REACH;
        ty = (dy / dist) * pull * GAZE_REACH * 0.7;
      }
      look.x = lerp(look.x, tx, reduced ? 1 : 0.12 * dt);
      look.y = lerp(look.y, ty, reduced ? 1 : 0.12 * dt);

      let squash = 1;
      if (!reduced) {
        if (blinkStart < 0 && t >= nextBlink) blinkStart = t;
        if (blinkStart >= 0) {
          const p = (t - blinkStart) / BLINK_MS;
          if (p >= 1) {
            blinkStart = -1;
            nextBlink = t + BLINK_GAP[0] + Math.random() * (BLINK_GAP[1] - BLINK_GAP[0]);
          } else {
            // down and back up
            squash = Math.abs(Math.cos(p * Math.PI));
          }
        }
      }

      const rec = Skia.PictureRecorder();
      const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, w, (w * VIEW_H) / VIEW_W));
      canvas.scale(w / VIEW_W, w / VIEW_W);
      canvas.translate(PAD, PAD);
      canvas.drawPath(s.body, s.fill);
      canvas.translate(-PAD, -PAD);
      const eye = (path: SkPath | null, e: Eye) => {
        if (!path) return;
        canvas.save();
        canvas.translate(look.x + PAD + def.center.x + e.dx, look.y + PAD + def.center.y + e.dy);
        canvas.rotate(e.rot, 0, 0);
        canvas.scale(1, squash);
        s.eye.setStrokeWidth(e.w);
        canvas.drawPath(path, s.eye);
        canvas.restore();
      };
      eye(s.left, pose.l);
      eye(s.right, pose.r);
      picture.value = rec.finishRecordingAsPicture();

      if (active && !reduced) raf = requestAnimationFrame(frame);
    };

    // one call settles the pose; it schedules the loop itself when there is motion to run
    frame(now());
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      reduced = on;
      if (on) {
        cancelAnimationFrame(raf);
        frame(now());
      }
    });
    const appSub = AppState.addEventListener('change', (st) => {
      active = st === 'active';
      if (active && !raf && !reduced) {
        last = now();
        raf = requestAnimationFrame(frame);
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      appSub.remove();
    };
  }, [def, pose]);

  return (
    <Canvas
      style={[{ width: size, height: (size * VIEW_H) / VIEW_W }, style]}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : label}
      importantForAccessibility={decorative ? 'no-hide-descendants' : undefined}
      accessibilityElementsHidden={decorative}
    >
      <Picture picture={picture} />
    </Canvas>
  );
}

export { Avatar };
export type { ShapeId };
