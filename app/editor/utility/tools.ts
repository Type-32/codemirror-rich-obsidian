import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { type SyntaxNode, type SyntaxNodeRef } from '@lezer/common'

export function cursorInNode(
    cursorFrom: number | undefined,
    cursorTo: number | undefined,
    nodeFrom: number | undefined,
    nodeTo: number | undefined
) {
    const cf = cursorFrom || 0, ct = cursorTo || 0, nf = nodeFrom || 0, nt = nodeTo || 0
    return (cf >= nf && cf <= nt) || (ct >= nf && ct <= nt) || (cf <= nf && ct >= nt)
}

export function cursorSelectionCoveredNode(
    cursorFrom: number | undefined,
    cursorTo: number | undefined,
    nodeFrom: number | undefined,
    nodeTo: number | undefined
) {
    const cf = cursorFrom || 0, ct = cursorTo || 0, nf = nodeFrom || 0, nt = nodeTo || 0
    return (cf <= nf && ct >= nt)
}

export function toCursorNodePositions(state: EditorState, node?: SyntaxNodeRef) {
    const [cursor] = state.selection.ranges
    return {
        cursorFrom: cursor?.from || 0,
        cursorTo: cursor?.to || 0,
        nodeFrom: node?.from || 0,
        nodeTo: node?.to || 0
    }
}

export function isNodeRangeActive(state: EditorState, nodeFrom: number, nodeTo: number): boolean {
    const cursor = state.selection.main
    if (cursor.empty) {
        return cursor.from >= nodeFrom && cursor.from <= nodeTo
    } else {
        return Math.max(nodeFrom, cursor.from) < Math.min(nodeTo, cursor.to)
    }
}

export function isCursorInRange(state: EditorState, range: [from: number, to: number]) {
    return state.selection.ranges.some((r) => {
        const from = Math.min(r.from, r.to)
        const to = Math.max(r.from, r.to)
        return from >= range[0] && to <= range[1]
    })
}
