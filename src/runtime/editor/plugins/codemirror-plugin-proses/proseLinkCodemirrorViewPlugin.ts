import {Decoration, type DecorationSet, EditorView} from '@codemirror/view';
import {StateField, RangeSet} from '@codemirror/state';
import {syntaxTree} from '@codemirror/language';
import type {EditorState, Range as EditorRange} from '@codemirror/state';
import { cursorSelectionCoveredNode, isNodeRangeActive, toCursorNodePositions } from '../../utility/tools'
import {ProseVueComponentEmbedWidget} from "../codemirror-widgets/proseVueComponentEmbedWidget";
import ImageEmbedComponent from "../../../components/Editor/ImageEmbedComponent.vue";

function buildLinkDecorations(state: EditorState): EditorRange<Decoration>[] {
    const decorations: EditorRange<Decoration>[] = [];
    const widgets: EditorRange<Decoration>[] = [];

    syntaxTree(state).iterate({
        enter({node}) {
            if (node.name === 'Image') {
                const poses = toCursorNodePositions(state, node);
                const isActive = isNodeRangeActive(state, node.from, node.to) || cursorSelectionCoveredNode(poses.cursorFrom, poses.cursorTo, poses.nodeFrom, poses.nodeTo);
                if (!isActive) {
                    const urlNode = node.getChild('URL');
                    if (urlNode) {
                        const url = state.doc.sliceString(urlNode.from, urlNode.to);
						const displayString = state.doc.sliceString(2, urlNode.from - 2)
                        decorations.push(Decoration.replace({
                            widget: new ProseVueComponentEmbedWidget(ImageEmbedComponent, { filePath: url, display: displayString }, node.from),
                            block: true,
                        }).range(node.from, node.to));
                    }
                }
                return false;
            }

            if (node.name === 'Link') {
                const poses = toCursorNodePositions(state, node)
                const isActive = isNodeRangeActive(state, node.from, node.to) || cursorSelectionCoveredNode(poses.cursorFrom, poses.cursorTo, poses.nodeFrom, poses.nodeTo);
                if (!isActive) {
                    const allMarks = node.getChildren('LinkMark');
                    const urlNode = node.getChild('URL');

                    const openBracket = allMarks.find(m => state.doc.sliceString(m.from, m.to) === '[');
                    const closeBracket = allMarks.find(m => state.doc.sliceString(m.from, m.to) === ']');

                    if (urlNode && openBracket && closeBracket) {
                        const linkTextStart = openBracket.to;
                        const linkTextEnd = closeBracket.from;
                        const url = state.doc.sliceString(urlNode.from, urlNode.to);
                        const text = state.doc.sliceString(linkTextStart, linkTextEnd);

                        const linkAttributes = {
                            'href': url,
                            'target': '_blank',
                            'class': 'cm-clickable-link',
                            'data-external-link': 'true',
                            'data-url': url,
                            'data-text': text
                        };

                        decorations.push(Decoration.replace({}).range(node.from, linkTextStart));
                        decorations.push(Decoration.replace({}).range(linkTextEnd, node.to));

                        decorations.push(Decoration.mark({
                            tagName: 'a',
                            attributes: linkAttributes
                        }).range(linkTextStart, linkTextEnd));

                        return false;
                    }
                }
                return false;
            }

            if (node.name === 'URL') {
                const url = state.doc.sliceString(node.from, node.to);
                const isImage = /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(url) || url.includes('picsum.photos');

                if (isImage) {
                    const line = state.doc.lineAt(node.from);
                    widgets.push(Decoration.widget({
                        widget: new ProseVueComponentEmbedWidget(ImageEmbedComponent, { filePath: url }, node.from),
                        block: true,
                        side: 1
                    }).range(line.to));
                }

                if (!isNodeRangeActive(state, node.from, node.to)) {
                    decorations.push(Decoration.mark({
                        tagName: 'a',
                        attributes: {
                            href: url,
                            target: '_blank',
                            class: 'cm-clickable-link',
                            'data-external-link': 'true',
                            'data-url': url
                        }
                    }).range(node.from, node.to));
                }
            }
        }
    });

    return [...decorations, ...widgets];
}

export const proseLinkCodemirrorViewPlugin = StateField.define<DecorationSet>({
    create(state) {
        return RangeSet.of(buildLinkDecorations(state), true);
    },
    update(value, tr) {
        if (tr.docChanged || tr.selection) {
            return RangeSet.of(buildLinkDecorations(tr.state), true);
        }
        return value.map(tr.changes);
    },
    provide: f => EditorView.decorations.from(f)
});
