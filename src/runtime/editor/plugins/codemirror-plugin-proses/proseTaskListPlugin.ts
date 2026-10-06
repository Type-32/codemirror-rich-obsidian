import { Decoration, EditorView, ViewPlugin, ViewUpdate, WidgetType, type DecorationSet } from '@codemirror/view'
import type { Range } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { selectionWithin } from '../../utility/tools'
import { TreeCursor } from '@lezer/common'

class CheckboxWidget extends WidgetType {
    constructor(
        private readonly checked: string | undefined,
        private readonly from: number,
        private readonly to: number
    ) {
        super()
    }

    public override eq(other: CheckboxWidget): boolean {
        return other.checked === this.checked && other.from === this.from && other.to === this.to
    }

    public override toDOM(view: EditorView): HTMLElement {
        const checkbox = document.createElement('div')
        checkbox.classList.add('cm-task-checkbox-wrapper')

        if (this.checked && this.checked.toLowerCase() === 'x') {
            checkbox.dataset.checked = 'true'
        } else if (this.checked && this.checked !== ' ') {
            checkbox.dataset.special = this.checked
            checkbox.innerText = this.checked
        } else {
            checkbox.dataset.checked = 'false'
        }

        checkbox.onclick = (event) => {
            event.preventDefault()
            const isChecked = checkbox.dataset.checked === 'true'
            const char = checkbox.dataset.special ? ' ' : !isChecked ? 'x' : ' '
            view.dispatch({
                changes: {
                    from: this.from + 1,
                    to: this.to - 1,
                    insert: char,
                },
            })
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

                        const checkedChar = state.doc.sliceString(
                            taskMarker.from + 1,
                            taskMarker.to - 1,
                        )
                        const isChecked =
                            checkedChar && checkedChar.toLowerCase() === 'x'

                        if (isChecked) {
                            const line = state.doc.lineAt(listItem.from)
                            decorations.push(
                                Decoration.line({
                                    attributes: { class: 'cm-task-checked' },
                                }).range(line.from),
                            )
                        }

                        if (
                            selectionWithin(state, listMark.from, listMark.to) ||
                            selectionWithin(state, taskMarker.from, taskMarker.to)
                        )
                            return

                        decorations.push(
                            Decoration.replace({
                                widget: new CheckboxWidget(
                                    state.doc.sliceString(taskMarker.from + 1, taskMarker.to - 1),
                                    taskMarker.from,
                                    taskMarker.to
                                ),
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
