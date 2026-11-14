import { EditorView } from '@codemirror/view'
import { StateEffect, StateField, type EditorState } from '@codemirror/state'

/**
 * True when any selection range touches [from, to] (inclusive, so a cursor sitting
 * right at a node edge counts as "in" it). The single live-preview predicate: show
 * source when it touches, render otherwise. A non-editable view (read-only editor,
 * nested rendering such as a callout body) never reveals source.
 */
export function selectionTouches(state: EditorState, from: number, to: number): boolean {
    if (!state.facet(EditorView.editable)) return false
    for (const r of state.selection.ranges) {
        if (r.from <= to && r.to >= from) return true
    }
    return false
}

/** True when any selection range lies entirely inside [from, to]. Never in a non-editable view (see `selectionTouches`). */
export function selectionWithin(state: EditorState, from: number, to: number): boolean {
    if (!state.facet(EditorView.editable)) return false
    for (const r of state.selection.ranges) {
        if (r.from >= from && r.to <= to) return true
    }
    return false
}

/** True when `a` and `b` are on the same visual (wrapped) line; true when either isn't rendered. */
export function sameVisualLine(view: EditorView, a: number, b: number): boolean {
    const ca = view.coordsAtPos(a), cb = view.coordsAtPos(b)
    return !ca || !cb || Math.abs(ca.top - cb.top) < 1
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

/**
 * Live-preview reveal rules shared by the list, task and hanging-indent plugins (Obsidian's): a bullet shows its
 * source while a cursor is on the mark itself (`|-|`, not after the space); a task while it's anywhere from the
 * list mark to the closing `]`.
 */
export function markRevealed(state: EditorState, mark: { from: number, to: number }, taskMarker?: { to: number } | null): boolean {
    return selectionWithin(state, mark.from, taskMarker ? taskMarker.to : mark.to)
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
