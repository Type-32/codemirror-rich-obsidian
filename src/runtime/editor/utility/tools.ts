import { EditorView } from '@codemirror/view'
import { StateEffect, StateField, type EditorState } from '@codemirror/state'

/**
 * True when any selection range touches [from, to] (inclusive, so a cursor sitting
 * right at a node edge counts as "in" it). The single live-preview predicate: show
 * source when it touches, render otherwise.
 */
export function selectionTouches(state: EditorState, from: number, to: number): boolean {
    for (const r of state.selection.ranges) {
        if (r.from <= to && r.to >= from) return true
    }
    return false
}

/** True when any selection range lies entirely inside [from, to]. */
export function selectionWithin(state: EditorState, from: number, to: number): boolean {
    for (const r of state.selection.ranges) {
        if (r.from >= from && r.to <= to) return true
    }
    return false
}

/** Nesting depth of a line: each leading tab or 4-space group is one level. */
export function indentLevel(lineText: string): number {
    let level = 0
    for (let i = 0; i < lineText.length; ) {
        if (lineText[i] === '\t') i++
        else if (lineText.startsWith('    ', i)) i += 4
        else break
        level++
    }
    return level
}

export const setMouseSelecting = StateEffect.define<boolean>()

/**
 * True while the user is drag-selecting. Prose plugins skip rebuilds during the drag and
 * rebuild once on release, so marks reveal on mouseup (like Obsidian) instead of flickering
 * on every mousemove.
 */
export const mouseSelectingField = StateField.define<boolean>({
    create: () => false,
    update(value, tr) {
        for (const e of tr.effects) if (e.is(setMouseSelecting)) return e.value
        return value
    },
})

export const mouseSelectingTracker = [
    mouseSelectingField,
    EditorView.domEventHandlers({
        mousedown(_e, view) {
            const up = () => {
                window.removeEventListener('mouseup', up)
                view.dispatch({ effects: setMouseSelecting.of(false) })
            }
            window.addEventListener('mouseup', up)
            view.dispatch({ effects: setMouseSelecting.of(true) })
        },
    }),
]
