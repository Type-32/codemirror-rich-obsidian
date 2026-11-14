import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import type { EditorState, Line, Range } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'
import { markRevealed } from '../../utility/tools'

/**
 * A horizontal width as CSS terms, so theme variables stay live: leading indent groups (one `.cm-indent`
 * each, `--list-indent` wide), list-mark paddings, rendered checkboxes, and measured text in px.
 */
export interface Width {
    indents: number
    pads: number
    boxes: number
    px: number
}

export type Measure = (text: string) => number

/** Quote markers, then indent groups (tab or 4 spaces, each wrapped in `.cm-indent`), then leftover spaces. */
const PREFIX = /^((?: {0,3}> ?)*)((?:\t| {4})*)([ \t]*)/
const NO_LAYOUT: Record<string, true> = { FencedCode: true, CodeBlock: true, YAMLFrontMatter: true, TexBlock: true, HTMLBlock: true, CommentBlock: true, Table: true }

export function cssWidth(w: Width): string {
    const terms: string[] = []
    if (w.indents) terms.push(`${w.indents} * var(--list-indent)`)
    if (w.pads) terms.push(`${w.pads} * var(--list-padding-inline-start)`)
    if (w.boxes) terms.push(`${w.boxes} * (var(--checkbox-size) + var(--checkbox-margin-inline-start) + var(--checkbox-margin-inline-end))`)
    if (w.px) terms.push(`${Math.round(w.px * 100) / 100}px`)
    return terms.length ? `calc(${terms.join(' + ')})` : '0px'
}

/** Width of everything before the text of `line`: quotes, indentation, and, if an item starts here, its list mark or checkbox. */
function prefix(state: EditorState, line: Line, measure: Measure): { width: Width, item: SyntaxNode | null } {
    const [, quote, groups, spaces] = PREFIX.exec(line.text)!
    const width: Width = { indents: groups!.split('\t').length - 1 + (groups!.replace(/\t/g, '').length / 4), pads: 0, boxes: 0, px: measure(quote! + spaces!) }
    const at = line.from + quote!.length + groups!.length + spaces!.length
    const mark = syntaxTree(state).resolveInner(at, 1)
    if (mark.name !== 'ListMark' || mark.from !== at) return { width, item: null }
    const taskMarker = mark.parent!.getChild('Task')?.getChild('TaskMarker')
    const rendered = taskMarker && !markRevealed(state, mark, taskMarker)
    const markEnd = taskMarker ? taskMarker.to : mark.to
    const textStart = markEnd + /^[ \t]*/.exec(state.sliceDoc(markEnd, line.to))![0].length
    if (rendered) {
        width.boxes = 1
        width.px += measure(state.sliceDoc(markEnd, textStart)) // the space after `]`; the checkbox replaces `- [ ]`
    }
    else {
        width.pads = 1
        width.px += measure(state.sliceDoc(mark.from, textStart)) // `- `, `10. `, or a revealed `- [ ] `
    }
    return { width, item: mark.parent }
}

/**
 * Hanging indent for `line`, Obsidian's way: `padding-inline-start: P; text-indent: -T` where T is the line's own
 * prefix, so the first row is unaffected and wrapped rows line up with the text. An indented continuation line
 * inside a list item wraps at the item's text, or at its own text if that is further right; a lazy one (no
 * indentation) sits at the margin like any paragraph line, as in Obsidian.
 * Null when the line has no prefix, no text, or is code/frontmatter/math/table.
 */
export function hangingIndent(state: EditorState, line: Line, measure: Measure): { padding: Width[], indent: Width } | null {
    if (!line.text.trim()) return null
    // Both ends: an indented fence inside a list item starts in the item but ends in the code.
    for (const [pos, side] of [[line.from, 1], [line.to, -1]] as const) {
        for (let n: SyntaxNode | null = syntaxTree(state).resolveInner(pos, side); n; n = n.parent) {
            if (!NO_LAYOUT[n.name]) continue
            // Code, math and the like keep their own layout; inside a quote they still wrap past its markers.
            const quote = /^(?: {0,3}> ?)*/.exec(line.text)![0]
            if (!quote) return null
            const w: Width = { indents: 0, pads: 0, boxes: 0, px: measure(quote) }
            return { padding: [w], indent: w }
        }
    }
    const own = prefix(state, line, measure)
    if (own.item) return { padding: [own.width], indent: own.width }
    const lazy = !/^[ \t]/.test(line.text.replace(/^(?: {0,3}> ?)*/, ''))
    for (let n: SyntaxNode | null = lazy ? null : syntaxTree(state).resolveInner(line.to, -1); n; n = n.parent) {
        if (n.name !== 'ListItem') continue
        const first = state.doc.lineAt(n.from)
        if (first.number !== line.number) return { padding: [prefix(state, first, measure).width, own.width], indent: own.width }
    }
    const w = own.width
    return w.indents || w.pads || w.boxes || w.px ? { padding: [w], indent: w } : null
}

/**
 * As custom properties, applied by `editor.css` on top of the line's own padding (`--line-indent-base`, e.g. a
 * quote's inset), so line types keep their base padding.
 */
export function hangingStyle(h: { padding: Width[], indent: Width }): string {
    const padding = h.padding.length > 1 ? `max(${h.padding.map(cssWidth).join(', ')})` : cssWidth(h.padding[0]!)
    return `--hang-padding: ${padding}; --hang-indent: ${cssWidth(h.indent)};`
}

// Text widths in the editor font, measured once per font and string. Cleared when web fonts finish loading.
const widths = new Map<string, number>()
let context: CanvasRenderingContext2D | null = null

function measurer(view: EditorView): Measure {
    const s = getComputedStyle(view.contentDOM)
    const font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`
    return (text) => {
        if (!text) return 0
        const key = `${font}\u0000${text}`
        let w = widths.get(key)
        if (w === undefined) {
            context ??= document.createElement('canvas').getContext('2d')!
            context.font = font
            w = context.measureText(text).width
            widths.set(key, w)
        }
        return w
    }
}

/**
 * Per-line hanging indents for list items, tasks, quotes, tab-indented lines and list continuations. The only
 * owner of line `style`, so other plugins' line decorations never fight over it.
 */
export const proseHangingIndentPlugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet
    private stale = false
    private readonly onFonts = () => {
        widths.clear()
        this.stale = true
        this.view.dispatch({})
    }

    constructor(readonly view: EditorView) {
        this.decorations = this.build()
        document.fonts?.addEventListener('loadingdone', this.onFonts)
    }

    update(u: ViewUpdate) {
        // Selection matters for tasks (checkbox vs revealed `- [ ]`); the tree, for parses finishing after load.
        if (this.stale || u.docChanged || u.viewportChanged || u.selectionSet || syntaxTree(u.startState) !== syntaxTree(u.state)) {
            this.stale = false
            this.decorations = this.build()
        }
    }

    destroy() {
        document.fonts?.removeEventListener('loadingdone', this.onFonts)
    }

    build(): DecorationSet {
        const { state } = this.view
        const measure = measurer(this.view)
        const out: Range<Decoration>[] = []
        for (const { from, to } of this.view.visibleRanges) {
            for (let pos = from; pos <= to;) {
                const line = state.doc.lineAt(pos)
                const h = hangingIndent(state, line, measure)
                if (h) out.push(Decoration.line({ attributes: { style: hangingStyle(h) } }).range(line.from))
                pos = line.to + 1
            }
        }
        return Decoration.set(out)
    }
}, { decorations: v => v.decorations })
