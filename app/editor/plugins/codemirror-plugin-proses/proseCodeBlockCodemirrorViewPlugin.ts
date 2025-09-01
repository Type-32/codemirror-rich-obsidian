import { Decoration, EditorView } from '@codemirror/view'
import { StateField, RangeSet, type Transaction } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import type { EditorState, Range as EditorRange } from '@codemirror/state'
import type { DecorationSet } from '@codemirror/view'
import { EndFenceWidget, LanguageFlairWidget } from '~/editor/plugins/codemirror-widgets/proseCodeBlockWidgets'
import { specialCodeBlockMapFacet, type SpecialCodeBlockMapping } from '~/editor/plugins/specialCodeBlockMappingConfig'
import { ProseVueComponentEmbedWidget } from '~/editor/plugins/codemirror-widgets/proseVueComponentEmbedWidget'
import { isNodeRangeActive } from '~/editor/utility/tools'

function buildCodeBlockDecorations(state: EditorState): EditorRange<Decoration>[] {
    const decorations: EditorRange<Decoration>[] = []
    const specialCodeBlocks = state.facet(specialCodeBlockMapFacet)

    syntaxTree(state).iterate({
        enter(node) {
            if (node.name === 'FencedCode') {
                const codeInfoNode = node.node.getChild('CodeInfo')
                let language = ''
                if (codeInfoNode) {
                    language = state.doc.sliceString(codeInfoNode.from, codeInfoNode.to)
                }

                const specialMapping = specialCodeBlocks.find((m: SpecialCodeBlockMapping) => m.codeInfo === language)

                // --- Extract pure code content ---
                const firstLineNode = state.doc.lineAt(node.from)
                let scanPos = node.to
                while (scanPos > node.from && /\s/.test(state.doc.sliceString(scanPos - 1, scanPos))) {
                    scanPos--
                }
                const lastLineNode = state.doc.lineAt(scanPos > node.from ? scanPos : node.from)
                let codeText = ''
                const firstContentLineNum = firstLineNode.number + 1
                const lastContentLineNum = lastLineNode.number - 1
                if (firstContentLineNum <= lastContentLineNum) {
                    const contentStartOffset = state.doc.line(firstContentLineNum).from
                    const contentEndOffset = state.doc.line(lastContentLineNum).to
                    codeText = state.doc.sliceString(contentStartOffset, contentEndOffset)
                }
                // --- End of code content extraction ---

                if (specialMapping && !isNodeRangeActive(state, node.from, node.to)) {
                    decorations.push(
                        Decoration.replace({
                            widget: new ProseVueComponentEmbedWidget(
                                specialMapping.component,
                                { codeContent: codeText },
                                node.from
                            ),
                            block: true,
                        }).range(node.from, node.to)
                    )
                    return false
                }

                // --- Fallback to default code block styling ---
                const cursor = state.selection.main
                for (
                    let currentLineNum = firstLineNode.number;
                    currentLineNum <= lastLineNode.number;
                    currentLineNum++
                ) {
                    const line = state.doc.line(currentLineNum)
                    let lineClasses = ['cm-codeblock']
                    const cursorFocusedOnThisLine = cursor.anchor >= line.from && cursor.anchor <= line.to

                    if (currentLineNum === firstLineNode.number) {
                        lineClasses.push('cm-line-codeblock-begin')
                        if (!cursorFocusedOnThisLine) {
                            decorations.push(
                                Decoration.replace({
                                    widget: new LanguageFlairWidget(language, codeText),
                                }).range(line.from, line.to)
                            )
                        }
                    } else if (currentLineNum === lastLineNode.number) {
                        lineClasses.push('cm-line-codeblock-end')
                        if (!cursorFocusedOnThisLine) {
                            decorations.push(
                                Decoration.replace({
                                    widget: new EndFenceWidget(),
                                }).range(line.from, line.to)
                            )
                        }
                    } else {
                        lineClasses.push('cm-line-codeblock-content')
                    }

                    decorations.push(
                        Decoration.line({
                            attributes: { class: lineClasses.join(' ') },
                        }).range(line.from)
                    )
                }
                return false
            }
        },
    })
    return decorations
}

export const proseCodeBlockCodemirrorViewPlugin = StateField.define<DecorationSet>({
    create(state: EditorState) {
        return RangeSet.of(buildCodeBlockDecorations(state), true)
    },
    update(value: DecorationSet, tr: Transaction) {
        if (tr.docChanged || tr.selection) {
            return RangeSet.of(buildCodeBlockDecorations(tr.state), true)
        }
        return value.map(tr.changes)
    },
    provide: (f: StateField<DecorationSet>) => EditorView.decorations.from(f),
})
