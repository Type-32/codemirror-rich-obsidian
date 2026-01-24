import { Decoration, EditorView } from '@codemirror/view'
import { StateField, RangeSet, type Transaction } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import type { EditorState, Range as EditorRange, SelectionRange } from '@codemirror/state'
import type { DecorationSet } from '@codemirror/view'
import { EndFenceWidget, LanguageFlairWidget } from '../codemirror-widgets/proseCodeBlockWidgets'
import { specialCodeBlockMapFacet } from '../specialCodeBlockMappingConfig'
import { ProseVueComponentEmbedWidget } from '../codemirror-widgets/proseVueComponentEmbedWidget'
import { cursorSelectionCoveredNode, isNodeRangeActive, toCursorNodePositions } from '../../utility/tools'
import type { SpecialCodeBlockMapping } from '#codemirror-rich-obsidian-editor/editor-types'

/**
 * Finds all FencedCode node ranges in the syntax tree
 */
function getFencedCodeRanges(state: EditorState): Array<{ from: number, to: number }> {
    const ranges: Array<{ from: number, to: number }> = []
    syntaxTree(state).iterate({
        enter(node) {
            if (node.name === 'FencedCode') {
                ranges.push({ from: node.from, to: node.to })
                return false // Don't descend into children
            }
        }
    })
    return ranges
}

/**
 * Checks if cursor is inside any of the given ranges
 */
function isCursorInAnyRange(cursor: SelectionRange, ranges: Array<{ from: number, to: number }>): boolean {
    return ranges.some(range => 
        (cursor.from >= range.from && cursor.from <= range.to) ||
        (cursor.to >= range.from && cursor.to <= range.to) ||
        (cursor.from <= range.from && cursor.to >= range.to)
    )
}

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

                const poses = toCursorNodePositions(state, node)

                if (specialMapping != undefined && !(isNodeRangeActive(state, node.from, node.to) || cursorSelectionCoveredNode(poses.cursorFrom, poses.cursorTo, poses.nodeFrom, poses.nodeTo))) {
                    if (specialMapping)
                        decorations.push(
                            Decoration.replace({
                                widget: new ProseVueComponentEmbedWidget(
                                    specialMapping.component,
                                    { codeContent: codeText },
                                    node.from,
                                    node.from,
                                    node.to
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
                    const cursorFocusedOnThisLine = (cursor.anchor >= line.from && cursor.anchor <= line.to) || cursorSelectionCoveredNode(poses.cursorFrom, poses.cursorTo, poses.nodeFrom, poses.nodeTo)

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
    update(oldDecorations: DecorationSet, tr: Transaction) {
        // If document changed, rebuild everything
        if (tr.docChanged) {
            return RangeSet.of(buildCodeBlockDecorations(tr.state), true)
        }
        
        // If only selection changed, check if cursor entered/left any code blocks
        if (tr.selection) {
            const oldCursor = tr.startState.selection.main
            const newCursor = tr.state.selection.main
            
            // Get all FencedCode ranges from syntax tree
            const codeBlockRanges = getFencedCodeRanges(tr.state)
            
            // Check if cursor state changed (entered or left a code block)
            const wasInCodeBlock = isCursorInAnyRange(oldCursor, codeBlockRanges)
            const isInCodeBlock = isCursorInAnyRange(newCursor, codeBlockRanges)
            
            // Rebuild if cursor entered or left any code block
            if (wasInCodeBlock !== isInCodeBlock) {
                return RangeSet.of(buildCodeBlockDecorations(tr.state), true)
            }
            
            // Cursor moved but didn't cross code block boundaries
            return oldDecorations
        }
        
        return oldDecorations.map(tr.changes)
    },
    provide: (f: StateField<DecorationSet>) => EditorView.decorations.from(f),
})
