# AIMO

A face for your agents. One file, no dependency to maintain — for React, React Native and anything
on the web (Vue, Svelte, Angular, Astro, plain HTML).

<p align="center">
  <a href="https://aimo.nrmk.dev"><strong>aimo.nrmk.dev</strong></a>
</p>

## Install

```bash
npx aimo-cli add lumi
```

The CLI reads your `package.json` and writes the right file into your components folder.

**React** — `aimo.tsx`:

```tsx
import { Avatar } from './components/aimo';

export function Header() {
  return <Avatar shape="ball" size={48} />;
}
```

**React Native / Expo** — `aimo.tsx`, drawn with Skia:

```bash
npx expo install @shopify/react-native-skia react-native-reanimated react-native-worklets
```

**Everything else** — `aimo.js`, a Web Component:

```html
<script type="module" src="./components/aimo.js"></script>
<aimo-avatar shape="ball" size="48"></aimo-avatar>
```

No CSS to import. The file is yours — read it, change it, keep it in your own repository.

## What the free component does

- **Two shapes** — `ball` and `square`
- **An idle face** that blinks and follows the pointer
- **Flat finish**, any colour, any size
- Respects `prefers-reduced-motion`, and stops animating when scrolled out of view

```tsx
<Avatar shape="square" color="#4a30c8" size={64} />
<Avatar shape="ball" gazeRadius={0} decorative />   {/* no gaze, hidden from screen readers */}
```

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `shape` | `'ball' \| 'square'` | `'ball'` | Body silhouette |
| `color` | `string` | `'#31c943'` | Body colour; the eyes pick black or white for contrast |
| `size` | `number` | — | Rendered width in px |
| `gazeRadius` | `number` | `1.45` | How far the pointer is noticed, in half body widths. `0` turns the glance off |
| `decorative` | `boolean` | `false` | Hides it from assistive tech when the text beside it already says what it means |

## AIMO Pro

[AIMO Pro](https://aimo.nrmk.dev/#/pro) is a one-time purchase that adds fourteen shapes, eight
expressions, the glass finish with its glow and shimmer, custom icons, and a commercial licence.
Same API, same file layout — swapping one file for the other moves nothing in your layout, because
both render into the same box.

```bash
npx aimo-cli add lumi --key AIMO-XXXXX-XXXXX-XXXXX
```

## Licence

The component in this repository and the CLI are [MIT](LICENSE). AIMO Pro is a separate
[commercial licence](https://aimo.nrmk.dev/#/licence).

---

Made by [nrmk.dev](https://nrmk.dev) · hello@nrmk.dev
