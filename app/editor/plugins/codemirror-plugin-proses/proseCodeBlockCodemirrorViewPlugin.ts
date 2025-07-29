import { Decoration, EditorView } from '@codemirror/view';
import { StateField, RangeSet } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { EditorState, Range as EditorRange } from '@codemirror/state';
import type { DecorationSet } from '@codemirror/view';
import {EndFenceWidget, LanguageFlairWidget} from "~/editor/plugins/codemirror-widgets/proseCodeBlockWidgets";

function buildCodeBlockDecorations(state: EditorState): EditorRange<Decoration>[] {
    const decorations: EditorRange<Decoration>[] = [];
    const cursor = state.selection.main; // For checking cursor position

    syntaxTree(state).iterate({
        enter(node) {
            if (node.name === 'FencedCode') {
                const firstLineNode = state.doc.lineAt(node.from);
                // The FencedCode node.to is usually AFTER the closing ``` and its newline.
                // So, the actual text of the last fence is on the line *before* node.to if node.to is at a line break.
                // A robust way to get the last line is to iterate until node.to.
                let lastLineNodeActualEnd = node.to;
                // Find the actual textual end of the FencedCode block (before any trailing newlines if node.to points after them)
                let scanPos = node.to;
                while (scanPos > node.from && /\s/.test(state.doc.sliceString(scanPos - 1, scanPos))) {
                    scanPos--;
                }
                const lastLineNode = state.doc.lineAt(scanPos > node.from ? scanPos : node.from);
                let lastLineNodeNum = lastLineNode.number
                if (lastLineNode.text != '```')
                    lastLineNodeNum += 1;


                let language = '';
                const codeInfoNode = node.node.getChild('CodeInfo'); // Standard Lezer Markdown name
                if (codeInfoNode) {
                    language = state.doc.sliceString(codeInfoNode.from, codeInfoNode.to);
                }

                // --- Extract pure code content ---
                let codeText = "";
                const firstContentLineNum = firstLineNode.number + 1;
                const lastContentLineNum = lastLineNodeNum - 1;

                if (firstContentLineNum <= lastContentLineNum) {
                    const contentStartOffset = state.doc.line(firstContentLineNum).from;
                    const contentEndOffset = state.doc.line(lastContentLineNum).to;
                    codeText = state.doc.sliceString(contentStartOffset, contentEndOffset);
                }
                // --- End of code content extraction ---

                for (let currentLineNum = firstLineNode.number; currentLineNum <= lastLineNode.number; currentLineNum++) {
                    const line = state.doc.line(currentLineNum);
                    let lineClasses = ['cm-codeblock']; // Base class for all code block lines

                    // More precise: is the cursor's anchor (caret) on this line?
                    const cursorFocusedOnThisLine = cursor.anchor >= line.from && cursor.anchor <= line.to;

                    if (currentLineNum === firstLineNode.number) { // First line of the block
                        lineClasses.push('cm-line-codeblock-begin');
                        if (!cursorFocusedOnThisLine) {
                            decorations.push(Decoration.replace({
                                widget: new LanguageFlairWidget(language, codeText),
                            }).range(line.from, line.to)); // Replace entire line content
                        }
                    } else if (currentLineNum === lastLineNodeNum) { // Last line of the block
                        lineClasses.push('cm-line-codeblock-end');
                        if (!cursorFocusedOnThisLine) {
                            decorations.push(Decoration.replace({
                                widget: new EndFenceWidget(),
                            }).range(line.from, line.to)); // Replace entire line content
                        }
                    } else { // Content lines within the code block
                        lineClasses.push('cm-line-codeblock-content');
                    }

                    // Apply computed classes to the line
                    decorations.push(Decoration.line({
                        attributes: { class: lineClasses.join(' ') }
                    }).range(line.from));
                }
                return false; // Don't iterate into children of FencedCode for *this* iteration purpose
            }
        }
    });
    return decorations;
}

export const proseCodeBlockCodemirrorViewPlugin = StateField.define<DecorationSet>({
    create(state) {
        return RangeSet.of(buildCodeBlockDecorations(state), true);
    },
    update(value, tr) {
        if (tr.docChanged || tr.selection) {
            return RangeSet.of(buildCodeBlockDecorations(tr.state), true);
        }
        return value.map(tr.changes);
    },
    provide: f => EditorView.decorations.from(f)
});