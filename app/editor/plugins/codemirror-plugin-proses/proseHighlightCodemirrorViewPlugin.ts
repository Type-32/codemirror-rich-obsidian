import { Decoration, type DecorationSet, EditorView } from '@codemirror/view'
import { StateField, RangeSet } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import type { EditorState, Range as EditorRange } from '@codemirror/state'
import { isNodeRangeActive } from '~/editor/utility/tools'

function buildHighlightDecorations(state: EditorState): EditorRange<Decoration>[] {
    const decorations: EditorRange<Decoration>[] = []

    syntaxTree(state).iterate({
        enter(node) {
            if (node.name === 'Mark') {
                const markers = node.node.getChildren('MarkMarker')
                if (markers.length < 2) return

                const openMark = state.doc.sliceString(markers[0]?.from || 0, markers[0]?.to || 0)
                if (openMark !== '==') return

                const closeMark = state.doc.sliceString(
                    markers[markers.length - 1]?.from || 0,
                    markers[markers.length - 1]?.to || 0
                )
                if (closeMark !== '==') return

                if (isNodeRangeActive(state, node.from, node.to)) {
                    return
                }

                const startContent = markers[0]?.to || 0
                const endContent = markers[markers.length - 1]?.from || 0

                decorations.push(
                    Decoration.mark({
                        class: 'cm-highlighted',
                        tagName: 'span',
                    }).range(startContent, endContent)
                )

                decorations.push(Decoration.replace({}).range(markers[0]?.from || 0, markers[0]?.to || 0))
                decorations.push(
                    Decoration.replace({}).range(markers[markers.length - 1]?.from || 0, markers[markers.length - 1]?.to || 0)
                )
            }
        },
    })

    return decorations
}

export const proseHighlightCodemirrorViewPlugin = StateField.define<DecorationSet>({
    create(state) {
        return RangeSet.of(buildHighlightDecorations(state), true)
    },
    update(value, tr) {
        if (tr.docChanged || tr.selection) {
            return RangeSet.of(buildHighlightDecorations(tr.state), true)
        }
        return value.map(tr.changes)
    },
    provide: (f) => EditorView.decorations.from(f),
})
