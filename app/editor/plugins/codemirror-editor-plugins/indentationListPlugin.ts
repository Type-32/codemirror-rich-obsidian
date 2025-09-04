import { Decoration, ViewPlugin, type DecorationSet, ViewUpdate, EditorView } from '@codemirror/view'
import { Line, RangeSetBuilder } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'

function getLineIndent(line: Line) {
    const match = line.text.match(/^(?:\t| {4})*/)
    if (!match) return 0
    return match[0].length
}

function decorate(view: EditorView) {
    const builder = new RangeSetBuilder<Decoration>()
    for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
            from,
            to,
            enter: (node) => {
                if (node.name === 'ListItem') {
                    const line = view.state.doc.lineAt(node.from)
                    const indentLevel = getLineIndent(line) + 1
                    
                    builder.add(
                        line.from,
                        line.from,
                        Decoration.line({
                            attributes: { class: `cm-list-line cm-list-line-${indentLevel}` },
                        })
                    )
                    
                    let contentFrom = -1, contentTo = -1;
                    
                    const listMark = node.node.getChild('ListMark');
                    if(listMark) {
                        contentFrom = listMark.to + 1;
                        contentTo = node.to;
                    }
                    
                    if (contentFrom !== -1) {
                        builder.add(
                            contentFrom,
                            contentTo,
                            Decoration.mark({
                                class: `cm-list-${indentLevel}`,
                            })
                        )
                    }
                }
            },
        })
    }
    return builder.finish()
}

export const indentationListPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet
        
        constructor(view: EditorView) {
            this.decorations = decorate(view)
        }
        
        update(update: ViewUpdate) {
            if (update.docChanged || update.viewportChanged) {
                this.decorations = decorate(update.view)
            }
        }
    },
    {
        decorations: v => v.decorations,
    }
)
