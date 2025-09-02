import { RangeSetBuilder } from '@codemirror/state'
import { EditorView, Decoration, type DecorationSet, ViewUpdate, WidgetType, ViewPlugin } from '@codemirror/view'
import { EditorState, EditorSelection, type TransactionSpec } from '@codemirror/state'
import { syntaxTree, foldable, foldEffect, unfoldEffect, foldedRanges } from '@codemirror/language'

class FoldWidget extends WidgetType {
    isFolded: boolean
    isHeader: boolean

    constructor(isFolded: boolean, isHeader: boolean = false) {
        super()
        this.isFolded = isFolded
        this.isHeader = isHeader
    }

    override eq(other: FoldWidget) {
        return other.isFolded == this.isFolded
    }

    toDOM() {
        let el = document.createElement('div')
        el.className = 'cm-fold-widget collapse-indicator collapse-icon'
        if (this.isFolded) el.classList.add('is-collapsed')
        this.isHeader ? el.classList.add('heading-collapse-indicator') : el.classList.add('list-collapse-indicator')

        // Simple triangle icon
        const icon = document.createElement('span')
        icon.innerText = '▸'
        icon.style.cursor = 'pointer'
        icon.style.transform = this.isFolded ? 'rotate(0deg)' : 'rotate(90deg)'
        el.appendChild(icon)

        return el
    }

    override ignoreEvent() {
        return false
    }
}

function foldExists(state: EditorState, from: number, to: number) {
    const folded = foldedRanges(state)
    let found = false
    folded.between(from, from, (a: number, b: number) => {
        if (a == from && b == to) found = true
    })
    return found
}

function announceFold(view: EditorView, range: { from: number; to: number }, fold = true) {
    let lineFrom = view.state.doc.lineAt(range.from).number,
        lineTo = view.state.doc.lineAt(range.to).number
    console.log('announceFold', lineFrom, lineTo)
    return EditorView.announce.of(
        `${view.state.phrase(fold ? 'Folded lines' : 'Unfolded lines')} ${lineFrom} ${view.state.phrase(
            'to'
        )} ${lineTo}.`
    )
}

const editorAttributesPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet

        constructor(view: EditorView) {
            this.decorations = this.buildDecorations(view)
        }

        update(update: ViewUpdate) {
            if (update.docChanged || update.viewportChanged || update.selectionSet) {
                this.decorations = this.buildDecorations(update.view)
            } else if (update.geometryChanged) {
                for (let tr of update.transactions) {
                    for (let effect of tr.effects) {
                        if (effect && effect.value) {
                            if (effect.is(foldEffect) || effect.is(unfoldEffect)) {
                                this.decorations = this.buildDecorations(update.view)
                            }
                        }
                    }
                }
            }
        }

        destroy() {}

        buildDecorations(view: EditorView): DecorationSet {
            const hashTagRegexp = /#(?:[^\u2000-\u206F\u2E00-\u2E7F'!"#$%&()*+,.:;<=>?@^`{|}~\[\]\\\s])+/g
            let builder = new RangeSetBuilder<Decoration>()
            const processedLinesForTags = new Set<number>()

            for (let { from, to } of view.visibleRanges) {
                syntaxTree(view.state).iterate({
                    from,
                    to,
                    enter: (node) => {
                        const isHeader = node.name.startsWith('ATXHeading')
                        const isList = node.name === 'ListItem'

                        if (isList || isHeader) {
                            let range,
                                line = view.state.doc.lineAt(node.from)
                            if ((range = foldable(view.state, line.from, line.to))) {
                                const isFolded = foldExists(view.state, range.from, range.to)
                                let deco = Decoration.widget({
                                    widget: new FoldWidget(isFolded, isHeader),
                                })
                                builder.add(node.from, node.from, deco)
                            }
                        }

                        if (node.name === 'HashtagTag') {
                            const line = view.state.doc.lineAt(node.from)
                            if (!processedLinesForTags.has(line.number)) {
                                const tags = line.text.match(hashTagRegexp)
                                if (tags) {
                                    const tagAttribute = tags.join(' ').replace(/#/g, '')
                                    let deco = Decoration.line({
                                        attributes: { 'data-tags': tagAttribute },
                                    })
                                    builder.add(line.from, line.from, deco)
                                }
                                processedLinesForTags.add(line.number)
                            }
                        }
                    },
                })
            }
            return builder.finish()
        }
    },
    {
        decorations: (v: { decorations: DecorationSet }) => v.decorations,

        eventHandlers: {
            mousedown: (e: MouseEvent, view: EditorView) => {
                let target = (e.target as HTMLElement).closest('.cm-fold-widget')
                if (target) {
                    const foldMarkerPos = view.posAtDOM(target)
                    const line = view.state.doc.lineAt(foldMarkerPos)
                    let range = foldable(view.state, line.from, line.to)
                    if (range) {
                        let curPos = view.state.selection.main.head
                        let effect = foldExists(view.state, range.from, range.to) ? unfoldEffect : foldEffect
                        let transaction: TransactionSpec = { effects: effect.of(range), }
                        if (curPos >= range.from && curPos <= range.to) {
                            transaction.selection = EditorSelection.cursor(range.to)
                        }
                        view.dispatch(transaction)
                        return true
                    }
                }
            },
        },
    }
)

export { editorAttributesPlugin }
