#!/usr/bin/env node
/**
 * aimo-cli — puts the mascot component into your project.
 *
 *   npx aimo-cli add lumi                     the free file, MIT
 *   npx aimo-cli add lumi --key AIMO-…        the Pro file, against your licence
 *   npx aimo-cli key AIMO-…                   remember the key, then plain `add` gets Pro
 *
 * Which file depends on the project: a React app gets `aimo.tsx`, a React Native app gets the Skia
 * renderer (also `aimo.tsx`), anything else (Vue, Svelte, Angular, Astro, plain HTML) gets `aimo.js`,
 * the same face as a Web Component. It is read from package.json; `--target` overrides it.
 *
 * This package is deliberately empty of components. The free file is downloaded from the site, the
 * Pro file from an API that checks the licence first — nothing licensed is ever published to npm,
 * which is the whole point of shipping a CLI rather than a library.
 *
 * No dependencies: Node 18 has fetch, and a tool people run with npx should not make them wait for
 * an install tree.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';

const CONFIG = join(homedir(), '.aimo', 'config.json');

/** What each target downloads and where it lands. */
const TARGETS = {
  react: { file: 'aimo.tsx', remote: 'aimo.tsx', label: 'React component' },
  element: { file: 'aimo.js', remote: 'aimo.js', label: 'Web Component' },
  // lands as aimo.tsx like the web file, so `import { Avatar } from './aimo'` reads the same
  native: { file: 'aimo.tsx', remote: 'aimo.native.tsx', label: 'React Native component' },
};
const TARGET_ALIASES = { react: 'react', element: 'element', wc: 'element', web: 'element', 'web-component': 'element', html: 'element', vue: 'element', svelte: 'element', angular: 'element', native: 'native', 'react-native': 'native', rn: 'native', expo: 'native' };

/** What the native file draws with; the CLI checks for them rather than installing behind your back. */
const NATIVE_DEPS = ['@shopify/react-native-skia', 'react-native-reanimated', 'react-native-worklets'];

// the character the component draws; accepted as a word so the command reads like a sentence
const NAMES = ['lumi', 'avatar', 'mascot', 'aimo'];

const c = {
  dim: (s) => `\u001b[2m${s}\u001b[0m`,
  bold: (s) => `\u001b[1m${s}\u001b[0m`,
  green: (s) => `\u001b[32m${s}\u001b[0m`,
  red: (s) => `\u001b[31m${s}\u001b[0m`,
};

const die = (msg, hint) => {
  console.error(`${c.red('✗')} ${msg}`);
  if (hint) console.error(`  ${c.dim(hint)}`);
  process.exit(1);
};

// AIMO_SITE is where the licence key gets POSTed, so an override must be https — otherwise
// the key travels in the clear to whatever host the environment happens to name. localhost
// and 127.0.0.1 are exempt so `add` still works against a dev server on plain http.
function resolveSite() {
  const raw = process.env.AIMO_SITE;
  if (!raw) return 'https://aimo.nrmk.dev';

  let url;
  try {
    url = new URL(raw);
  } catch {
    die('AIMO_SITE is not a valid URL.', 'Unset it, or point it at an https:// address.');
    return raw;
  }
  const isLocalHttp = url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  if (url.protocol !== 'https:' && !isLocalHttp) {
    die('AIMO_SITE must be https, or the licence key would travel in the clear.', 'http is only allowed for localhost or 127.0.0.1.');
    return raw;
  }
  return raw;
}

const SITE = resolveSite();

const HELP = `
${c.bold('aimo-cli')} — a face for your agents

  ${c.bold('npx aimo-cli add lumi')}              add the free component (MIT) for this project
  ${c.bold('npx aimo-cli add lumi --key AIMO-…')} add AIMO Pro with your licence key
  ${c.bold('npx aimo-cli key AIMO-…')}            save your key for next time
  ${c.bold('npx aimo-cli key --forget')}          remove the saved key

Options for ${c.bold('add')}
  --key <key>     licence key; also read from AIMO_KEY or the saved config
  --target <t>    react, native (React Native / Expo), or element (a Web Component for
                  Vue, Svelte, Angular, HTML…); read from package.json when left out
  --dir <path>    where to write it (default: your components folder, or ./components)
  --force         overwrite an existing file

Pro is a one-time purchase: ${SITE}/#/pro
`;

// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') flags.help = true;
    else if (a === '--version' || a === '-v') flags.version = true;
    else if (a === '--force' || a === '-f') flags.force = true;
    else if (a === '--forget') flags.forget = true;
    else if (a === '--key') flags.key = argv[++i];
    else if (a === '--dir') flags.dir = argv[++i];
    else if (a === '--target') flags.target = argv[++i];
    else if (a.startsWith('--target=')) flags.target = a.slice(9);
    else if (a.startsWith('--key=')) flags.key = a.slice(6);
    else if (a.startsWith('--dir=')) flags.dir = a.slice(6);
    else if (a.startsWith('-')) die(`Unknown option ${a}`, 'Run `npx aimo-cli --help`.');
    else positional.push(a);
  }
  return { positional, flags };
}

async function readConfig() {
  try {
    return JSON.parse(await readFile(CONFIG, 'utf8'));
  } catch {
    return {};
  }
}

async function writeConfig(next) {
  await mkdir(dirname(CONFIG), { recursive: true });
  // 0600: a licence key is a credential, so it should not be world-readable on a shared machine
  await writeFile(CONFIG, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
}

const looksLikeKey = (k) => typeof k === 'string' && /^AIMO(-[0-9A-HJKMNP-TV-Z]{5}){3}$/.test(k.trim());

/** The project's package.json dependencies, or null outside a Node project (a plain HTML site). */
async function projectDeps() {
  try {
    const pkg = JSON.parse(await readFile(resolve(process.cwd(), 'package.json'), 'utf8'));
    return { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
  } catch {
    return null;
  }
}

/**
 * React gets the component, React Native (and Expo) the Skia renderer; everything else gets the Web
 * Component, which runs in any framework and none.
 */
async function detect(deps) {
  if (deps && ('react-native' in deps || 'expo' in deps)) return { target: 'native', framework: 'expo' in deps ? 'Expo' : 'React Native' };
  if (deps && 'react' in deps) return { target: 'react', framework: deps.next ? 'Next.js' : 'React' };
  const known = [['vue', 'Vue'], ['nuxt', 'Nuxt'], ['svelte', 'Svelte'], ['@angular/core', 'Angular'], ['astro', 'Astro'], ['solid-js', 'Solid'], ['lit', 'Lit']];
  const hit = known.find(([dep]) => deps && dep in deps);
  return { target: 'element', framework: hit ? hit[1] : deps ? null : 'HTML' };
}

/** How to use the Web Component in the framework we found. */
function elementHint(framework, importPath, tier) {
  const tag = `<aimo-avatar shape="${tier === 'Pro' ? 'bumps' : 'ball'}" size="48"></aimo-avatar>`;
  if (framework === 'HTML') return [`<script type="module" src="${importPath}"></script>`, tag];
  const lines = [`import '${importPath}';`, tag];
  if (framework === 'Vue' || framework === 'Nuxt') {
    lines.push('', c.dim('Tell Vue the tag is not one of its components (vite.config):'), c.dim("  vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('aimo-') } } })"));
  }
  if (framework === 'Angular') lines.push('', c.dim('Add CUSTOM_ELEMENTS_SCHEMA to the schemas of the component that uses it.'));
  return lines;
}

/** Land next to the code the project already has, rather than inventing a folder at the root. */
function guessDir() {
  for (const d of ['src/components', 'app/components', 'components', 'src/lib', 'src/ui', 'src']) {
    if (existsSync(resolve(process.cwd(), d))) return d;
  }
  return 'components';
}

async function download(url, init) {
  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    die('Could not reach the network.', String(err?.message ?? err));
  }
  return res;
}

// ---------------------------------------------------------------------------

async function cmdAdd(positional, flags) {
  const name = positional[0];
  if (name && !NAMES.includes(name.toLowerCase())) {
    die(`There is no component called "${name}".`, `Try: npx aimo-cli add lumi`);
  }

  const saved = await readConfig();
  const key = (flags.key ?? process.env.AIMO_KEY ?? saved.key)?.trim();
  if (key && !looksLikeKey(key)) {
    die('That does not look like a licence key.', 'Keys look like AIMO-XXXXX-XXXXX-XXXXX.');
  }

  const deps = await projectDeps();
  let { target: kind, framework } = await detect(deps);
  if (flags.target) {
    kind = TARGET_ALIASES[String(flags.target).toLowerCase()];
    if (!kind) die(`Unknown target "${flags.target}".`, 'Use --target react, native or element.');
    framework = kind === 'react' ? 'React' : kind === 'native' ? (deps && 'expo' in deps ? 'Expo' : 'React Native') : framework;
  }
  const { file, remote, label } = TARGETS[kind];

  const dir = flags.dir ?? guessDir();
  const target = resolve(process.cwd(), dir, file);
  if (existsSync(target) && !flags.force) {
    die(`${relative(process.cwd(), target)} already exists.`, 'Pass --force to overwrite it.');
  }

  let source;
  let tier;

  if (key) {
    const res = await download(`${SITE}/api/pro`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(kind === 'react' ? { key } : { key, target: kind }),
    });
    if (res.status === 403) {
      const body = await res.json().catch(() => ({}));
      die(body.error ?? 'That key was not recognised.', 'Check the email you received, or write to hello@nrmk.dev.');
    }
    if (!res.ok) die(`The server said ${res.status}.`, 'If this keeps happening, write to hello@nrmk.dev.');
    source = await res.text();
    tier = 'Pro';
  } else {
    const res = await download(`${SITE}/${remote}`);
    if (!res.ok) die(`Could not download the component (${res.status}).`);
    source = await res.text();
    tier = 'Free';
  }

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, source);

  const where = relative(process.cwd(), target);
  const kb = (Buffer.byteLength(source) / 1024).toFixed(1);
  const detected = flags.target ? '' : framework ? c.dim(` for ${framework}`) : '';
  console.log(`${c.green('✓')} AIMO ${tier} ${label} → ${c.bold(where)} ${c.dim(`(${kb} kB)`)}${detected}`);
  console.log('');
  if (kind === 'react' || kind === 'native') {
    console.log(`  import { Avatar } from './${where.replace(/\.tsx$/, '').split('/').pop()}';`);
    console.log(`  <Avatar shape="${tier === 'Pro' ? 'bumps' : 'ball'}" size={48} />`);
    const missing = kind === 'native' ? NATIVE_DEPS.filter((d) => !deps || !(d in deps)) : [];
    if (missing.length) {
      console.log('');
      console.log(`  It draws with Skia. Install what is missing:`);
      console.log(`  ${c.bold(`${deps && 'expo' in deps ? 'npx expo install' : 'npm install'} ${missing.join(' ')}`)}`);
    }
  } else {
    const importPath = `./${where.split('/').pop()}`;
    for (const line of elementHint(framework, importPath, tier)) console.log(line ? `  ${line}` : '');
  }
  console.log('');
  if (tier === 'Free') {
    console.log(c.dim(`  Free covers two shapes and an idle face. Every shape, state and the glass finish:`));
    console.log(c.dim(`  ${SITE}/#/pro`));
  } else if (!flags.key && !process.env.AIMO_KEY) {
    console.log(c.dim('  Used your saved licence key.'));
  } else {
    // hint only — the key itself is not echoed, so it never lands in CI/build logs
    console.log(c.dim('  Save the key so you do not have to paste it again: npx aimo-cli key <your key>'));
  }
}

async function cmdKey(positional, flags) {
  if (flags.forget) {
    await writeConfig({});
    console.log(`${c.green('✓')} Key forgotten.`);
    return;
  }
  const key = (positional[0] ?? flags.key)?.trim();
  if (!key) {
    const saved = await readConfig();
    if (saved.key) {
      console.log(`Saved key: ${c.bold(saved.key)}  ${c.dim(CONFIG)}`);
      return;
    }
    die('No key given and none saved.', 'npx aimo-cli key AIMO-XXXXX-XXXXX-XXXXX');
  }
  if (!looksLikeKey(key)) die('That does not look like a licence key.', 'Keys look like AIMO-XXXXX-XXXXX-XXXXX.');
  await writeConfig({ ...(await readConfig()), key });
  console.log(`${c.green('✓')} Saved. ${c.dim(CONFIG)}`);
  console.log(`  Now ${c.bold('npx aimo-cli add lumi')} gets you Pro.`);
}

// ---------------------------------------------------------------------------

const { positional, flags } = parseArgs(process.argv.slice(2));
const [command, ...rest] = positional;

if (flags.version) {
  const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
  console.log(pkg.version);
} else if (flags.help || !command) {
  console.log(HELP);
} else if (command === 'add') {
  await cmdAdd(rest, flags);
} else if (command === 'key') {
  await cmdKey(rest, flags);
} else {
  die(`Unknown command "${command}".`, 'Run `npx aimo-cli --help`.');
}
