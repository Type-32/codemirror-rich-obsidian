import {Decoration, type DecorationSet, EditorView} from '@codemirror/view';
import { StateField, RangeSet } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { EditorState, Range as EditorRange } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';
import {internalLinkMapFacet} from "~/editor/plugins/linkMappingConfig";
import {ProseVueComponentEmbedWidget} from "~/editor/plugins/codemirror-widgets/proseVueComponentEmbedWidget";

function isNodeRangeActive(state: EditorState, nodeFrom: number, nodeTo: number): boolean {
    const cursor = state.selection.main;
    if (cursor.empty) {
        return cursor.from >= nodeFrom && cursor.from <= nodeTo;
    } else {
        return Math.max(nodeFrom, cursor.from) < Math.min(nodeTo, cursor.to);
    }
}

function buildInternalLinkDecorations(state: EditorState): EditorRange<Decoration>[] {
    const decorations: EditorRange<Decoration>[] = [];
    const linkMap = state.facet(internalLinkMapFacet);
    const widgets: EditorRange<Decoration>[] = [];

    syntaxTree(state).iterate({
        enter(node) {
            if (node.name === 'Embed') {
                const pathNode = node.node.getChild('InternalLink')?.getChild('InternalPath');
                if (pathNode) {
                    const path = state.doc.sliceString(pathNode.from, pathNode.to);
                    const linkInfo = linkMap.find(l => l.internalLinkName === path);

                    if (linkInfo?.embedComponent) {
                        const line = state.doc.lineAt(node.from);
                        const props: Record<string, any> = { linkData: linkInfo };
                        if (linkInfo.filePath) {
                            props.filePath = linkInfo.filePath;
                        }

                        widgets.push(Decoration.widget({
                            widget: new ProseVueComponentEmbedWidget(linkInfo.embedComponent, props, node.from),
                            block: true,
                            side: 1
                        }).range(line.to));

                        if (!isNodeRangeActive(state, node.from, node.to)) {
                            decorations.push(Decoration.replace({}).range(node.from, node.to));
                        }
                        return false;
                    }
                }
            }

            if (node.name === 'InternalLink' || node.name === 'Embed') {
                const mainNode = node.node;
                const isActive = isNodeRangeActive(state, mainNode.from, mainNode.to);
                if (isActive) return;

                const contentContainerNode = node.name === 'Embed' ? mainNode.getChild('InternalLink') : mainNode;
                if (!contentContainerNode) return;

                const pathNode = contentContainerNode.getChild('InternalPath');
                if (!pathNode) return;

                const path = state.doc.sliceString(pathNode.from, pathNode.to);
                const subpathNode = contentContainerNode.getChild('InternalSubpath');
                const aliasNode = contentContainerNode.getChild('InternalDisplay');
                const subpath = subpathNode ? state.doc.sliceString(subpathNode.from, subpathNode.to) : undefined;
                const alias = aliasNode ? state.doc.sliceString(aliasNode.from, aliasNode.to) : undefined;

                const linkInfo = linkMap.find(l => l.internalLinkName === path);

                // Skip decoration if it's an embed that should be a widget
                if (node.name === 'Embed' && linkInfo?.embedComponent) {
                    return false;
                }

                const linkAttributes: { [key: string]: string } = {
                    'class': 'cm-link',
                    'href': '#',
                    'data-internal-link': 'true',
                    'data-path': path,
                    'data-type': node.name === 'Embed' ? 'embed' : 'internal-link'
                };

                if (!linkInfo) {
                    linkAttributes['class'] += ' cm-unresolved-link';
                }

                if (subpath) linkAttributes['data-subpath'] = subpath;
                if (alias) linkAttributes['data-display'] = alias;

                if (node.name === 'Embed') {
                    const embedMark = mainNode.getChild('EmbedMark');
                    if (embedMark) {
                        decorations.push(Decoration.replace({}).range(embedMark.from, embedMark.to));
                    }
                }

                if (aliasNode) {
                    decorations.push(Decoration.mark({ tagName: 'a', attributes: linkAttributes }).range(aliasNode.from, aliasNode.to));
                    decorations.push(Decoration.replace({}).range(pathNode.from, pathNode.to));
                    if (subpathNode) {
                        decorations.push(Decoration.replace({}).range(subpathNode.from, subpathNode.to));
                    }
                } else {
                    const linkStart = pathNode.from;
                    const linkEnd = subpathNode ? subpathNode.to : pathNode.to;
                    decorations.push(Decoration.mark({ tagName: 'a', attributes: linkAttributes }).range(linkStart, linkEnd));
                }

                contentContainerNode.getChildren('InternalMark').forEach(mark => {
                    decorations.push(Decoration.replace({}).range(mark.from, mark.to));
                });

                return false;
            }
        }
    });

    return [...decorations, ...widgets];
}

export { isNodeRangeActive };

export const proseInternalLinkCodemirrorViewPlugin = StateField.define<DecorationSet>({
    create(state) {
        return RangeSet.of(buildInternalLinkDecorations(state), true);
    },
    update(value, tr) {
        if (tr.docChanged || tr.selection) {
            return RangeSet.of(buildInternalLinkDecorations(tr.state), true);
        }
        return value.map(tr.changes);
    },
    provide: f => EditorView.decorations.from(f)
});
