import { EditorView, keymap } from '@codemirror/view'
import { EditorSelection, Transaction, type SelectionRange } from '@codemirror/state'
import { completionKeymap } from '@codemirror/autocomplete'

type MarkdownKeymapCommand = (view: EditorView) => boolean

const toggleMarkdownFormatting = (mark: string): MarkdownKeymapCommand => {
    return (view: EditorView): boolean => {
        const { state, dispatch } = view
        const { selection } = state

        if (selection.ranges.length === 0) {
            return false
        }

        const transactions = selection.ranges.map((range: SelectionRange) => {
            if (range.empty) {
                const { from } = range
                // Case 1: Cursor is on a word.
                const word = state.wordAt(from)
                if (word) {
                    const wordText = state.doc.sliceString(word.from, word.to)

                    // Check if the word is already wrapped and unwrap if it is.
                    const textBeforeWord = state.doc.sliceString(word.from - mark.length, word.from)
                    const textAfterWord = state.doc.sliceString(word.to, word.to + mark.length)
                    if (textBeforeWord === mark && textAfterWord === mark) {
                        return state.update({
                            changes: [
                                { from: word.from - mark.length, to: word.from, insert: '' },
                                { from: word.to, to: word.to + mark.length, insert: '' },
                            ],
                            selection: { anchor: word.from - mark.length, head: word.to - mark.length },
                        })
                    }

                    // Otherwise, wrap it.
                    return state.update({
                        changes: {
                            from: word.from,
                            to: word.to,
                            insert: `${mark}${wordText}${mark}`,
                        },
                        selection: EditorSelection.range(word.from + mark.length, word.to + mark.length),
                    })
                }

                // Case 2: Fallback, just insert the marks.
                return state.update({
                    changes: { from: from, insert: `${mark}${mark}` },
                    selection: { anchor: from + mark.length },
                })
            } else {
                const selectedText = state.doc.sliceString(range.from, range.to)
                const textBefore = state.doc.sliceString(range.from - mark.length, range.from)
                const textAfter = state.doc.sliceString(range.to, range.to + mark.length)

                if (textBefore === mark && textAfter === mark) {
                    // Unwrap
                    return state.update({
                        changes: [
                            { from: range.from - mark.length, to: range.from },
                            { from: range.to, to: range.to + mark.length },
                        ],
                        selection: { anchor: range.from - mark.length, head: range.to - mark.length },
                    })
                } else {
                    // Wrap
                    return state.update({
                        changes: { from: range.from, to: range.to, insert: `${mark}${selectedText}${mark}` },
                        selection: { anchor: range.from + mark.length, head: range.to + mark.length },
                    })
                }
            }
        })

        // @ts-ignore
        const transaction = transactions.reduce((acc, tr) => {
            if (!tr) return acc
            const changes = acc.changes.compose(tr.changes)
            return {
                changes: changes,
                selection: tr.selection ? tr.selection : acc.selection?.map(changes),
                effects: acc.effects.concat(tr.effects),
            }
        }, state.update({}))

        if (transaction.changes.empty) {
            return false
        }

        dispatch(state.update(transaction))
        return true
    }
}

export const editorKeymapPlugin = keymap.of([
    {
        key: 'Mod-b',
        run: toggleMarkdownFormatting('**'),
    },
    {
        key: 'Mod-i',
        run: toggleMarkdownFormatting('*'),
    },
    {
        key: 'Mod-Shift-x',
        run: toggleMarkdownFormatting('~~'),
    },
    {
        key: 'Mod-Shift-h',
        run: toggleMarkdownFormatting('=='),
    },
    ...completionKeymap,
])
