/**
 * AIMO — a face for your agents.  https://aimo.nrmk.dev
 *
 * Free edition as a Web Component, MIT licensed. Two shapes, an idle face, flat finish.
 * Works in Vue, Svelte, Angular, Astro and plain HTML:
 *
 *   <script type="module" src="./aimo.js"></script>
 *   <aimo-avatar shape="ball" size="48"></aimo-avatar>
 *
 * AIMO Pro adds every shape and state, the glass finish and its effects: https://aimo.nrmk.dev/#/pro
 *
 * Generated file — edit it freely in your project, but regenerate rather than patch upstream.
 */

function hexToHsl(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    const n = m ? parseInt(m[1], 16) : 0x31c943;
    const r = ((n >> 16) & 255) / 255;
    const g = ((n >> 8) & 255) / 255;
    const b = (n & 255) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0)
        return { h: 0, s: 0, l: l * 100 };
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r)
        h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g)
        h = ((b - r) / d + 2) * 60;
    else
        h = ((r - g) / d + 4) * 60;
    return { h, s: s * 100, l: l * 100 };
}
const SHAPES = [
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
const DEFAULT_SHAPE = 'ball';
const getShape = (id) => SHAPES.find((s) => s.id === id) ?? SHAPES[0];
const EYE_POSES = {
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
 * `<aimo-avatar>`, free edition: the Web Component twin of `Avatar.tsx`, for anything that is not
 * React. One solid colour, two eyes, a blink and a glance at the pointer — and the same tag and
 * attribute names as the Pro element, so upgrading is swapping the file.
 *
 *   <script type="module" src="./aimo.js"></script>
 *   <aimo-avatar shape="ball" color="#31c943" size="48"></aimo-avatar>
 */
// Same padded box as the Pro renderer, so `size` means the same thing in both.
const PAD = 70;
const BODY_W = 400;
const BODY_H = 330;
const VIEW_W = BODY_W + PAD * 2;
const VIEW_H = BODY_H + PAD * 2;
/** How far the eyes travel toward the pointer, in viewBox units. */
const GAZE_REACH = 22;
const BLINK_MS = 240;
const BLINK_GAP = [2400, 6000];
const eyePath = (e) => `M0 ${(-e.len).toFixed(1)} Q${e.curve.toFixed(1)} 0 0 ${e.len.toFixed(1)}`;
const lerp = (a, b, t) => a + (b - a) * Math.min(1, t);
const esc = (v) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const STYLE = `:host{display:inline-block;width:96px;line-height:0;vertical-align:middle}
:host([hidden]){display:none}
svg{display:block;width:100%;height:auto;aspect-ratio:${VIEW_W}/${VIEW_H}}`;
/** A server-side import (Nuxt, SvelteKit, Astro) must not crash on the missing DOM; it just defines nothing. */
const Base = typeof HTMLElement === 'undefined' ? class {
} : HTMLElement;
class AimoAvatar extends Base {
    static observedAttributes = ['shape', 'color', 'size', 'gaze-radius', 'decorative', 'label'];
    root = null;
    stop = null;
    connectedCallback() {
        if (!this.root)
            this.root = this.attachShadow({ mode: 'open' });
        this.render();
    }
    disconnectedCallback() {
        this.stop?.();
        this.stop = null;
    }
    attributeChangedCallback(_name, prev, next) {
        if (prev !== next && this.isConnected)
            this.render();
    }
    render() {
        if (!this.root)
            return;
        this.stop?.();
        const def = getShape((this.getAttribute('shape') ?? DEFAULT_SHAPE));
        const color = this.getAttribute('color') ?? '#31c943';
        const size = Number(this.getAttribute('size'));
        this.style.width = size > 0 ? `${size}px` : '';
        const pose = EYE_POSES.neutral;
        // a light body needs dark eyes to read; anything else takes near-white
        const eyeColor = hexToHsl(color).l > 62 ? '#10131a' : '#f6f7fb';
        const decorative = this.hasAttribute('decorative') && this.getAttribute('decorative') !== 'false';
        const a11y = decorative ? ' aria-hidden="true"' : ` role="img" aria-label="${esc(this.getAttribute('label') ?? 'Avatar')}"`;
        const body = def.parts
            .map((p) => (p.kind === 'ellipse' ? `<ellipse cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}"></ellipse>` : `<path d="${p.d}"></path>`))
            .join('');
        const eye = (e) => `<g><path d="${eyePath(e)}" stroke="${eyeColor}" stroke-width="${e.w}" stroke-linecap="round" fill="none"></path></g>`;
        this.root.innerHTML =
            `<style>${STYLE}</style><svg viewBox="0 0 ${VIEW_W} ${VIEW_H}"${a11y}>` +
                `<g fill="${esc(color)}" transform="translate(${PAD} ${PAD})">${body}</g>` +
                `<g>${eye(pose.l)}${eye(pose.r)}</g></svg>`;
        const svg = this.root.querySelector('svg');
        const eyes = svg?.lastElementChild ?? null;
        const left = eyes?.firstElementChild ?? null;
        const right = eyes?.lastElementChild ?? null;
        if (!svg)
            return;
        const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const pointer = { x: 0, y: 0, seen: false };
        const look = { x: 0, y: 0 };
        let blinkStart = -1;
        let nextBlink = performance.now() + BLINK_GAP[0];
        let raf = 0;
        let last = performance.now();
        let visible = true;
        const onMove = (e) => {
            pointer.x = e.clientX;
            pointer.y = e.clientY;
            pointer.seen = true;
        };
        const onLeave = () => {
            pointer.seen = false;
        };
        const frame = (now) => {
            raf = 0;
            const dt = Math.min(3, (now - last) / 16.67);
            last = now;
            const gaze = this.getAttribute('gaze-radius');
            const radius = gaze === null ? 1.45 : gaze.trim().toLowerCase() === 'infinity' ? Infinity : Number(gaze) || 0;
            // where the eyes want to be: toward the pointer, but only once it is close enough
            let tx = 0;
            let ty = 0;
            if (pointer.seen && radius > 0) {
                const box = svg.getBoundingClientRect();
                const dx = pointer.x - (box.left + box.width / 2);
                const dy = pointer.y - (box.top + box.height / 2);
                const dist = Math.hypot(dx, dy);
                if (radius === Infinity || dist < (box.width / 2) * radius) {
                    const pull = Math.min(1, dist / (box.width / 2 || 1));
                    const len = dist || 1;
                    tx = (dx / len) * pull * GAZE_REACH;
                    ty = (dy / len) * pull * GAZE_REACH * 0.7;
                }
            }
            look.x = lerp(look.x, tx, reduced ? 1 : 0.12 * dt);
            look.y = lerp(look.y, ty, reduced ? 1 : 0.12 * dt);
            eyes?.setAttribute('transform', `translate(${look.x.toFixed(2)} ${look.y.toFixed(2)})`);
            let squash = 1;
            if (!reduced) {
                if (blinkStart < 0 && now >= nextBlink)
                    blinkStart = now;
                if (blinkStart >= 0) {
                    const t = (now - blinkStart) / BLINK_MS;
                    if (t >= 1) {
                        blinkStart = -1;
                        nextBlink = now + BLINK_GAP[0] + Math.random() * (BLINK_GAP[1] - BLINK_GAP[0]);
                    }
                    else {
                        // down and back up
                        squash = Math.abs(Math.cos(t * Math.PI));
                    }
                }
            }
            const place = (g, e) => g?.setAttribute('transform', `translate(${(PAD + def.center.x + e.dx).toFixed(1)} ${(PAD + def.center.y + e.dy).toFixed(1)}) rotate(${e.rot}) scale(1 ${squash.toFixed(3)})`);
            place(left, pose.l);
            place(right, pose.r);
            if (visible && !reduced)
                raf = requestAnimationFrame(frame);
        };
        // one call settles the pose; it schedules the loop itself when there is motion to run
        frame(performance.now());
        window.addEventListener('pointermove', onMove, { passive: true });
        document.addEventListener('pointerleave', onLeave);
        // stop the loop while the face is scrolled away
        const io = typeof IntersectionObserver === 'undefined'
            ? null
            : new IntersectionObserver(([entry]) => {
                visible = entry.isIntersecting;
                if (visible && !raf && !reduced) {
                    last = performance.now();
                    raf = requestAnimationFrame(frame);
                }
            }, { rootMargin: '200px' });
        io?.observe(svg);
        this.stop = () => {
            cancelAnimationFrame(raf);
            io?.disconnect();
            window.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerleave', onLeave);
        };
    }
}
if (typeof customElements !== 'undefined' && !customElements.get('aimo-avatar')) {
    customElements.define('aimo-avatar', AimoAvatar);
}
export { AimoAvatar };
