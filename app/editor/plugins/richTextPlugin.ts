import type {DecorationSet, EditorView, ViewUpdate} from '@codemirror/view'
import {Decoration, type PluginValue} from '@codemirror/view';
import {syntaxTree} from '@codemirror/language';
import type {Range} from '@codemirror/state';
import {cursorInNode} from "~/editor/utility/tools";
import {decorationBullet, decorationCode, decorationHidden, decorationTag} from "~/editor/utility/decorationTags";

const toggleableMarkTokens = [
    'InlineCode',
    'Emphasis',
    'StrongEmphasis',
    'FencedCode',
    'Link',
];

const tokenHidden = [
    'HardBreak',
    'LinkMark',
    'EmphasisMark',
    'CodeMark',
    'CodeInfo',
    'URL',
];

const alwaysHiddenTokens = [
    'CodeInfo', // Usually good to hide the language string like 'js'
];

export default class RichEditPlugin implements PluginValue {
    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.decorations = this.process(view);
    }

    update(update: ViewUpdate): void {
        if (update.docChanged || update.viewportChanged || update.selectionSet)
            this.decorations = this.process(update.view);
    }

    process(view: EditorView): DecorationSet {
        let widgets: Range<Decoration>[] = [];
        let [cursor] = view.state.selection.ranges;

        for (let {from, to} of view.visibleRanges) {
            syntaxTree(view.state).iterate({
                from, to,
                enter(node) {
                    const nodeName = node.name;
                    const nodeFrom = node.from;
                    const nodeTo = node.to;

                    if (nodeName === 'MarkdocTag')
                        widgets.push(decorationTag.range(nodeFrom, nodeTo));

                    if (nodeName === 'FencedCode')
                        widgets.push(decorationCode.range(nodeFrom, nodeTo));

                    if ((nodeName.startsWith('ATXHeading') || toggleableMarkTokens.includes(nodeName)) && cursorInNode(cursor?.from, cursor?.to, nodeFrom, nodeTo))
                        return false;

                    if (nodeName === 'ListMark' && node.matchContext(['BulletList', 'ListItem']) && cursor?.from != nodeFrom && cursor?.from != nodeFrom + 1)
                        widgets.push(decorationBullet.range(nodeFrom, nodeTo));

                    if (nodeName === 'HeaderMark')
                        widgets.push(decorationHidden.range(nodeFrom, nodeTo + 1));

                    if (tokenHidden.includes(node.name))
                        widgets.push(decorationHidden.range(nodeFrom, nodeTo));
                }
            });
        }

        return Decoration.set(widgets);
    }
}

