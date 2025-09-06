import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'
import { customBracketClosingConfig } from '../customBracketClosingConfig'

const bracketMap: { [key: string]: string } = {
    '(': ')',
    '{': '}',
    "'": "'",
    '"': '"',
    '[': ']',
}

const bracketClosingEventHandlers = {
    keydown(event: KeyboardEvent, view: EditorView) {
        if (!view.state.facet(customBracketClosingConfig)) return false

        // Handle opening brackets
        if (bracketMap[event.key]) {
            const closingBracket = bracketMap[event.key]
            const { state, dispatch } = view
            const { selection } = state

            if (selection.ranges.length > 1) return false

            const range = selection.main

            if (!range.empty) {
                const selectedText = state.doc.sliceString(range.from, range.to)
                const changes = {
                    from: range.from,
                    to: range.to,
                    insert: `${event.key}${selectedText}${closingBracket}`,
                }
                dispatch(
                    state.update({
                        changes,
                        selection: EditorSelection.range(range.from + 1, range.to + 1),
                        userEvent: 'input.type',
                    })
                )
                event.preventDefault()
                return true
            }

            const charAfter = state.doc.sliceString(range.from, range.from + 1)
            if (charAfter === closingBracket) {
                dispatch(
                    state.update({
                        selection: { anchor: range.from + 1 },
                        userEvent: 'input.type',
                    })
                )
                event.preventDefault()
                return true
            }

            const changes = {
                from: range.from,
                insert: `${event.key}${closingBracket}`,
            }
            dispatch(
                state.update({
                    changes,
                    selection: { anchor: range.from + 1 },
                    userEvent: 'input.type',
                })
            )
            event.preventDefault()
            return true
        }

        // Handle Backspace
        if (event.key === 'Backspace') {
            if (!view.state.facet(customBracketClosingConfig)) return false

            const { state, dispatch } = view
            const { selection } = state

            if (selection.ranges.length > 1 || !selection.main.empty) return false

            const range = selection.main
            const charBefore = state.doc.sliceString(range.from - 1, range.from)
            const charAfter = state.doc.sliceString(range.from, range.from + 1)

            if (bracketMap[charBefore] === charAfter) {
                dispatch(
                    state.update({
                        changes: { from: range.from - 1, to: range.from + 1, insert: '' },
                        userEvent: 'delete.backward',
                    })
                )
                event.preventDefault()
                return true
            }
        }

        return false
    },
}

export const customBracketClosingPlugin = ViewPlugin.fromClass(
    class {
        constructor(view: EditorView) {}
        update(update: ViewUpdate) {}
    },
    {
        eventHandlers: bracketClosingEventHandlers,
    }
)
