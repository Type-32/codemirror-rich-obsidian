import { type EditorView, WidgetType } from '@codemirror/view'
import type katexNs from 'katex'

type Katex = typeof katexNs
let katex: Katex | null = null
let loading: Promise<Katex> | null = null
// Rendered HTML keyed by `${display}:${source}`. Formulas repeat across a doc and across edits.
const cache: Record<string, string> = {}

/**
 * katex is an optional peer: loaded on the first formula widget, not at module import, so hosts
 * without it still boot. Widgets render a placeholder until it arrives, then fill in.
 */
function render(source: string, display: boolean, el: HTMLElement) {
    const key = `${display ? 'b' : 'i'}:${source}`
    const paint = () => {
        el.innerHTML = cache[key] ??= katex!.renderToString(source, { throwOnError: false, displayMode: display })
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
