import { syntaxTree } from '@codemirror/language'
import { StateField, type EditorState, type Text } from '@codemirror/state'
import type { Tree } from '@lezer/common'

/** One ATX heading: `level` 1–6, its text without `#`s, and the position of the heading line. */
export interface Heading {
    level: number
    text: string
    from: number
}

/** Top-level ATX headings of `tree` in document order (headings inside quotes or lists are not part of the outline). */
export function headingsOf(tree: Tree, doc: Text): Heading[] {
    const out: Heading[] = []
    for (let n = tree.topNode.firstChild; n; n = n.nextSibling) {
        const level = /^ATXHeading(\d)$/.exec(n.name)?.[1]
        if (!level) continue
        const open = n.firstChild?.name === 'HeaderMark' ? n.firstChild : null
        const close = n.lastChild?.name === 'HeaderMark' && n.lastChild.from !== open?.from ? n.lastChild : null
        out.push({ level: +level, text: doc.sliceString(open?.to ?? n.from, close?.from ?? n.to).trim(), from: n.from })
    }
    return out
}

/**
 * The document outline, kept current as the doc or its (incrementally parsed) syntax tree changes.
 * Add it to read headings from a view update without re-walking the tree per read.
 */
export const headingsField = StateField.define<Heading[]>({
    create: s => headingsOf(syntaxTree(s), s.doc),
    update: (value, tr) => (!tr.docChanged && syntaxTree(tr.state) === syntaxTree(tr.startState)
        ? value
        : headingsOf(syntaxTree(tr.state), tr.state.doc)),
})

/** Headings from `headingsField` when it is configured, otherwise computed now. */
export function headings(state: EditorState): Heading[] {
    return state.field(headingsField, false) ?? headingsOf(syntaxTree(state), state.doc)
}

/** The heading whose section contains `pos` (the last one starting at or before it), if any. */
export function headingAt(state: EditorState, pos: number): Heading | null {
    return headings(state).findLast(h => h.from <= pos) ?? null
}
