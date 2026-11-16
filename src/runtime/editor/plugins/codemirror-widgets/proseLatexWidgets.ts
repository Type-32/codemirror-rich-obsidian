import { type EditorView, WidgetType } from '@codemirror/view'
import type katexNs from 'katex'

type Katex = typeof katexNs
let katex: Katex | null = null
let loading: Promise<Katex> | null = null
// Rendered HTML keyed by `${display}:${source}`. Formulas repeat across a doc and across edits.
// ponytail: cleared wholesale at 500 entries; LRU if large math-heavy vaults re-render noticeably.
const cache = new Map<string, string>()

/**
 * Note math can't define macros: a few defining lines expand to millions of glyphs (`\def\a{…}\def\b{\a\a…}`, 10 KB
 * crashed the tab), and `maxExpand` counts expansions, not their size. Each definer renders as itself, in red, like
 * any command KaTeX doesn't know. `maxSize` (em) keeps `\rule` and kerns from covering the page.
 */
const DEFINERS = ['\\def', '\\gdef', '\\edef', '\\xdef', '\\let', '\\futurelet', '\\newcommand', '\\renewcommand', '\\providecommand', '\\DeclareMathOperator']
const macros = Object.fromEntries(DEFINERS.map(d => [d, `\\textcolor{#cc0000}{\\text{\\textbackslash ${d.slice(1)}}}`]))

/** KaTeX options for note math (a fresh `macros` each time: KaTeX writes global definitions into it). */
export const katexOptions = (displayMode: boolean) => ({ throwOnError: false, displayMode, macros: { ...macros }, maxSize: 100 })

/**
 * katex loads on the first formula widget, not at module import, so notes without math never fetch it. Widgets
 * render their source until it arrives, then fill in.
 */
function render(source: string, display: boolean, el: HTMLElement) {
    const key = `${display ? 'b' : 'i'}:${source}`
    const paint = () => {
        let html = cache.get(key)
        if (html === undefined) {
            if (cache.size >= 500) cache.clear()
            html = katex!.renderToString(source, katexOptions(display))
            cache.set(key, html)
        }
        el.innerHTML = html
    }
    if (katex) return paint()
    el.textContent = source
    loading ??= import('katex').then(m => (katex = m.default ?? m))
    loading.then(paint, () => { el.textContent = `[katex missing] ${source}` })
}

class LatexWidget extends WidgetType {
    constructor(readonly source: string, readonly nodeName: 'TexInline' | 'TexBlock') {
        super()
    }

    override eq(other: LatexWidget) {
        return other.source === this.source && other.nodeName === this.nodeName
    }

    toDOM(view: EditorView) {
        const display = this.nodeName === 'TexBlock'
        const el = document.createElement(display ? 'div' : 'span')
        render(this.source, display, el)
        el.addEventListener('click', () => {
            const pos = view.posAtDOM(el)
            view.dispatch({ selection: { anchor: pos } })
        })
        return el
    }

    override ignoreEvent() {
        return false
    }
}

export class InlineLatexWidget extends LatexWidget {
    constructor(source: string) { super(source, 'TexInline') }
}

export class BlockLatexWidget extends LatexWidget {
    constructor(source: string) { super(source, 'TexBlock') }
}
