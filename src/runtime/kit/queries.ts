import { syntaxTree } from '@codemirror/language'
import type { EditorState, SelectionRange } from '@codemirror/state'
import type { SyntaxNode } from '@lezer/common'

export type MarkType = 'bold' | 'italic' | 'strikethrough' | 'highlight'

/** Syntax node and the delimiter written for each inline mark. */
export const MARKS: Record<MarkType, { node: string, delim: string }> = {
    bold: { node: 'StrongEmphasis', delim: '**' },
    italic: { node: 'Emphasis', delim: '*' },
    strikethrough: { node: 'Strikethrough', delim: '~~' },
    highlight: { node: 'Mark', delim: '==' },
}

const DELIMITERS: Record<string, true> = { EmphasisMark: true, StrikethroughMark: true, MarkMarker: true }
const NOT_FORMATTABLE: Record<string, true> = { InlineCode: true, TexInline: true }

/** Widen [from, to] over directly adjacent emphasis delimiters, so `x` in `***x***` reaches both outer marks. */
function overDelimiters(state: EditorState, from: number, to: number): [number, number] {
    const tree = syntaxTree(state)
    for (let n = tree.resolveInner(from, -1); DELIMITERS[n.name] && n.to === from; n = tree.resolveInner(from, -1)) from = n.from
    for (let n = tree.resolveInner(to, 1); DELIMITERS[n.name] && n.from === to; n = tree.resolveInner(to, 1)) to = n.to
    return [from, to]
}

/**
 * Innermost `name` node containing [from, to] whose content [contentFrom, contentTo] the selection
 * covers exactly, either the content alone or the whole node (marks included). Partial selections don't match.
 */
function wrapping(state: EditorState, from: number, to: number, name: string, content: (n: SyntaxNode) => [number, number] | null): SyntaxNode | null {
    const [wideFrom, wideTo] = overDelimiters(state, from, to)
    for (let n: SyntaxNode | null = syntaxTree(state).resolveInner(from, 1); n; n = n.parent) {
        if (n.name !== name || n.from > from || n.to < to) continue
        const c = content(n)
        if (c && wideFrom <= c[0] && wideTo >= c[1]) return n
    }
    return null
}

const betweenFirstAndLast = (n: SyntaxNode): [number, number] | null =>
    n.firstChild && n.lastChild && n.firstChild.from !== n.lastChild.from ? [n.firstChild.to, n.lastChild.from] : null

/** The `type` mark node that exactly wraps [from, to], or null. */
export function markAt(state: EditorState, type: MarkType, from: number, to: number): SyntaxNode | null {
    return wrapping(state, from, to, MARKS[type].node, betweenFirstAndLast)
}

/** The `[[wikilink]]` that exactly wraps [from, to], or null. */
export function wikilinkAt(state: EditorState, from: number, to: number): SyntaxNode | null {
    return wrapping(state, from, to, 'InternalLink', betweenFirstAndLast)
}

export interface LinkInfo {
    node: SyntaxNode
    textFrom: number
    textTo: number
    url: string
    urlFrom: number
    urlTo: number
}

/** The inline `[text](url)` link whose text (or whole node) is exactly [from, to], or null. */
export function linkAt(state: EditorState, from: number, to: number): LinkInfo | null {
    const text = (n: SyntaxNode): [number, number] | null => {
        const [open, close] = n.getChildren('LinkMark')
        return open && close && n.getChild('URL') ? [open.to, close.from] : null
    }
    const node = wrapping(state, from, to, 'Link', text)
    if (!node) return null
    const [textFrom, textTo] = text(node)!
    const url = node.getChild('URL')!
    const raw = state.sliceDoc(url.from, url.to)
    return { node, textFrom, textTo, url: raw.replace(/^<(.*)>$/, '$1'), urlFrom: url.from, urlTo: url.to }
}

/**
 * The main selection if inline formatting applies to it: exactly one non-empty range inside a single
 * paragraph or heading, with neither end in inline code or inline math. Excludes code blocks, tables,
 * math blocks, frontmatter and cross-block selections, where inline delimiters can't span.
 */
export function formattableRange(state: EditorState): SelectionRange | null {
    const { ranges, main } = state.selection
    if (ranges.length !== 1 || main.empty) return null
    const tree = syntaxTree(state)
    let block: SyntaxNode | null = tree.resolveInner(main.from, 1)
    while (block && block.name !== 'Paragraph' && !block.name.startsWith('ATXHeading')) block = block.parent
    if (!block || main.to > block.to) return null
    for (const [pos, side] of [[main.from, 1], [main.to, -1]] as const) {
        for (let n: SyntaxNode | null = tree.resolveInner(pos, side); n; n = n.parent) {
            if (NOT_FORMATTABLE[n.name]) return null
        }
    }
    return main
}
