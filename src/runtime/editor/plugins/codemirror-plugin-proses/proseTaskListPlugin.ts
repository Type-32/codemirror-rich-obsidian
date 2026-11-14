import { Decoration, EditorView, ViewPlugin, ViewUpdate, WidgetType, type DecorationSet } from '@codemirror/view'
import type { Range } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { markRevealed } from '../../utility/tools'
import { TreeCursor } from '@lezer/common'

/**
 * Like Obsidian: every status but a space is checked; the status character goes in `data-task` (on the
 * checkbox and the line) so themes can style `[/]`, `[-]`, `[>]`… Clicking clears a checked status, or checks with `x`.
 */
class CheckboxWidget extends WidgetType {
    constructor(
        private readonly status: string,
        private readonly from: number,
        private readonly to: number
    ) {
        super()
    }

    public override eq(other: CheckboxWidget): boolean {
        return other.status === this.status && other.from === this.from && other.to === this.to
    }

    public override toDOM(view: EditorView): HTMLElement {
        const checkbox = document.createElement('div')
        checkbox.classList.add('cm-task-checkbox-wrapper')
        checkbox.dataset.task = this.status
        checkbox.dataset.checked = String(this.status !== ' ')
        checkbox.onclick = (event) => {
            event.preventDefault()
            view.dispatch({ changes: { from: this.from + 1, to: this.to - 1, insert: this.status === ' ' ? 'x' : ' ' } })
        }
        return checkbox
    }
}

export const proseTaskListPlugin = ViewPlugin.fromClass(
    class {
        public decorations = Decoration.none

        constructor(view: EditorView) {
            this.decorations = this.buildDecorations(view)
        }

        public update(update: ViewUpdate): void {
            if (update.docChanged || update.viewportChanged || update.selectionSet) {
                this.decorations = this.buildDecorations(update.view)
            }
        }

        buildDecorations(view: EditorView): DecorationSet {
            const decorations: Range<Decoration>[] = []
            const { state } = view

            for (const { from, to } of view.visibleRanges) {
                syntaxTree(state).iterate({
                    from,
                    to,
                    enter: (node: TreeCursor) => {
                        if (node.type.name !== 'Task') return

                        const { from: nodeFrom, to: nodeTo } = node

                        const listItem = node.node.parent
                        if (!listItem || listItem.type.name !== 'ListItem') return

                        const listMark = listItem.getChild('ListMark')
                        if (!listMark) return

                        const taskMarker = node.node.getChild('TaskMarker')
                        if (!taskMarker) return

                        const status = state.doc.sliceString(taskMarker.from + 1, taskMarker.to - 1)
                        decorations.push(
                            Decoration.line({
                                attributes: { class: 'cm-task-line', 'data-task': status },
                            }).range(state.doc.lineAt(listItem.from).from),
                        )

                        if (markRevealed(state, listMark, taskMarker)) return

                        decorations.push(
                            Decoration.replace({
                                widget: new CheckboxWidget(status, taskMarker.from, taskMarker.to),
                            }).range(listMark.from, taskMarker.to)
                        )
                    },
                })
            }
			
            return Decoration.set(decorations, true)
        }
    },
    {
        decorations: (value) => value.decorations,
    }
)
