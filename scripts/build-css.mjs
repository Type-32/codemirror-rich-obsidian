// `dist/editor.css`: the editor's stylesheet for hosts without Tailwind and Nuxt UI (the CodeMirror-only entry).
// Tailwind's theme and the utilities the stylesheet applies, Nuxt UI's design tokens with its default colours, no
// preflight, no styles on `body`. Hosts with Tailwind and Nuxt UI use the source stylesheet instead (`/tailwind.css`; the
// Nuxt module adds it itself). KaTeX's stylesheet is the host's own. Run by `build.config.ts` after the module build.
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import tailwind from '@tailwindcss/vite'
import ui from '@nuxt/ui/vite'
import colors from 'tailwindcss/colors'

const root = fileURLToPath(new URL('..', import.meta.url))

/** `text` with `part` cut out; fails loudly when a dependency's file no longer has it. */
function without(text, part, file) {
    if (!text.includes(part)) throw new Error(`${file} no longer contains ${JSON.stringify(part.slice(0, 60))}`)
    return text.replace(part, '')
}

export async function buildEditorCss() {
    const dir = await mkdtemp(join(tmpdir(), 'cm-editor-css-'))
    const run = (input, plugins) => build({
        root, configFile: false, logLevel: 'warn', plugins,
        build: { outDir: join(dir, 'out'), emptyOutDir: true, assetsDir: '', rollupOptions: { input, output: { assetFileNames: '[name][extname]' } } },
    })

    // Nuxt UI's Vite plugin generates its theme (`#build/ui.css`) into node_modules/.nuxt-ui on build.
    await writeFile(join(dir, 'probe.css'), '@import "#build/ui.css";')
    await run(join(dir, 'probe.css'), [ui({ autoImport: false, components: false }), tailwind()])

    const nuxtUi = join(root, 'node_modules/@nuxt/ui/dist/runtime')
    const generated = await readFile(join(root, 'node_modules/.nuxt-ui/ui.css'), 'utf8')
    // Without `@source "./ui"` (every component's classes) and the `body` styles (the page is the host's).
    const theme = without(without(generated, '@source "./ui";', 'ui.css'), generated.match(/@layer base \{[\s\S]*?\n\}\n/)?.[0] ?? '@layer base', 'ui.css')
    const index = await readFile(join(nuxtUi, 'index.css'), 'utf8')
    const tokens = without(without(index, '@import "#build/ui.css";', 'index.css'), '@source "./components";', 'index.css')
        .replace('"./keyframes.css"', JSON.stringify(join(nuxtUi, 'keyframes.css')))

    // Nuxt UI sets its palette at runtime from app.config (plugins/colors.js); these are its defaults, the same way.
    const palette = { primary: 'green', secondary: 'blue', success: 'green', info: 'blue', warning: 'yellow', error: 'red', neutral: 'slate' }
    const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
    const vars = shade => Object.keys(palette).filter(k => k !== 'neutral').map(k => `--ui-${k}: var(--ui-color-${k}-${shade});`).join(' ')
    const colorVars = `@layer theme {
  :root, :host { ${Object.entries(palette).flatMap(([key, color]) => shades.map(s => `--ui-color-${key}-${s}: var(--color-${color === 'neutral' ? 'old-neutral' : color}-${s}, ${colors[color][s]});`)).join(' ')} }
  :root, :host, .light { ${vars(500)} }
  .dark { ${vars(400)} }
}`

    const source = await readFile(join(root, 'src/runtime/assets/css/editor.css'), 'utf8')
    const body = without(source, `@import 'katex/dist/katex.min.css';\n@import 'tailwindcss';\n@import '@nuxt/ui';\n`, 'editor.css')

    const entry = join(dir, 'editor.css')
    await writeFile(entry, [
        `@import 'tailwindcss/theme' layer(theme);`,
        `@import 'tailwindcss/utilities' layer(utilities) source(none);`,
        theme, tokens, colorVars, body,
    ].join('\n'))
    await run(entry, [tailwind()])

    await mkdir(join(root, 'dist'), { recursive: true })
    await copyFile(join(dir, 'out/editor.css'), join(root, 'dist/editor.css'))
    await rm(dir, { recursive: true })
}
