import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { type SyntaxNode } from '@lezer/common'

export function cursorInNode(
    cursorFrom: number | undefined,
    cursorTo: number | undefined,
    nodeFrom: number | undefined,
    nodeTo: number | undefined
) {
    return (
        !((cursorFrom || 0) <= (nodeFrom || 0) && (cursorTo || 0) <= (nodeFrom || 0)) ||
        ((cursorFrom || 0) >= (nodeTo || 0) && (cursorTo || 0) >= (nodeTo || 0))
    )
}

export function isNodeRangeActive(state: EditorState, nodeFrom: number, nodeTo: number): boolean {
    const cursor = state.selection.main
    if (cursor.empty) {
        return cursor.from >= nodeFrom && cursor.from <= nodeTo
    } else {
        return Math.max(nodeFrom, cursor.from) < Math.min(nodeTo, cursor.to)
    }
}

export function iterateTreeInVisibleRanges(
    view: EditorView,
    callbacks: {
        enter: (node: { type: SyntaxNode['type']; from: number; to: number }) => void
    }
) {
    for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
            ...callbacks,
            from,
            to,
        })
    }
}

export function isCursorInRange(state: EditorState, range: [from: number, to: number]) {
    return state.selection.ranges.some((r) => {
        const from = Math.min(r.from, r.to)
        const to = Math.max(r.from, r.to)
        return from >= range[0] && to <= range[1]
    })
}
