# aimo-cli

Puts the [AIMO](https://aimo.nrmk.dev) mascot component into your project — one file you own and
can edit, not a dependency you have to keep upgrading. React gets a `.tsx` component, React Native
and Expo get the same face drawn with Skia, and Vue, Svelte, Angular, Astro and plain HTML get it as a
Web Component.

```bash
npx aimo-cli add lumi
```

It reads your `package.json` to pick the file, and writes it into your components folder (it looks
for `src/components`, `app/components`, `components`, `src/lib`, `src/ui`, `src` — or pass `--dir`).

### React

`aimo.tsx`:

```tsx
import { Avatar } from './components/aimo';

export function Header() {
  return <Avatar shape="ball" size={48} />;
}
```

No CSS to import, no runtime dependency beyond React.

### React Native and Expo

`aimo.tsx` again, drawn with [Skia](https://shopify.github.io/react-native-skia/) — the glass, the
blur and the shimmer look the same as on the web:

```bash
npx expo install @shopify/react-native-skia react-native-reanimated react-native-worklets
```

```tsx
import { Avatar } from './components/aimo';

<Avatar shape="bumps" emotion="happy" size={96} />
```

There is no pointer on a phone: `lookAt` is a point in the avatar's own box, and `voiceLevel` is a
0–1 loudness your audio library meters (a number, or a ref read every frame).

### Everything else — a Web Component

`aimo.js`, which defines `<aimo-avatar>`:

```html
<script type="module" src="./components/aimo.js"></script>
<aimo-avatar shape="ball" size="48"></aimo-avatar>
```

In a bundled app, `import './components/aimo.js'` once and use the tag anywhere. Attributes are the
React props in kebab-case (`star-color`, `shimmer-speed`, `gaze-radius`…). Vue needs to be told the
tag is not one of its components (`compilerOptions.isCustomElement`); Angular needs
`CUSTOM_ELEMENTS_SCHEMA`. The CLI prints the line for your framework.

Force a target with `--target react`, `--target native` or `--target element`.

## Free and Pro

The free file is MIT: two shapes (circle and square), an idle face, a flat finish, plus colour, size,
gaze and blink. It is enough to ship.

[AIMO Pro](https://aimo.nrmk.dev/#/pro) is a one-time purchase that adds all fourteen shapes, eight
states, the glass finish and its effects. After buying you get a licence key:

```bash
npx aimo-cli key AIMO-XXXXX-XXXXX-XXXXX   # remember it
npx aimo-cli add lumi                     # now you get Pro
```

Or pass it per command with `--key`, or set `AIMO_KEY` in the environment — handy in CI.

The key is stored in `~/.aimo/config.json` with `0600` permissions. It is a credential: do not commit
it, and do not paste it into a public repository.

## Commands

```
aimo-cli add lumi [--key <key>] [--target react|native|element] [--dir <path>] [--force]
aimo-cli key <key>        save a licence key
aimo-cli key              show the saved key
aimo-cli key --forget     remove it
aimo-cli --help
aimo-cli --version
```

Installed globally (`npm i -g aimo-cli`) the command is also available as plain `aimo`.

`add` refuses to overwrite an existing file unless you pass `--force`, so re-running it is safe.

## Why a CLI and not a package

This package contains no components. The free file is downloaded from the site; the Pro file comes
from an API that checks your licence first. Nothing licensed is ever published to npm — which is why
the delivery is a command rather than a library.

It also means the code lands in *your* repository, in a file you can read, diff and change. There is
no version of AIMO that can break your build from under you.

## Requirements

Node 18 or newer. No dependencies.

---

MIT for this CLI and for the free component. AIMO Pro is a
[commercial licence](https://aimo.nrmk.dev/#/licence). Questions: hello@nrmk.dev
