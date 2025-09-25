import {autocompletion, type CompletionContext, type CompletionResult} from "@codemirror/autocomplete";
import {syntaxTree} from "@codemirror/language";
import {internalLinkMapFacet} from "../linkMappingConfig";

function internalLinkSource(context: CompletionContext): CompletionResult | null {
    const node = syntaxTree(context.state).resolve(context.pos, -1);

    let textBefore = context.state.sliceDoc(node.from, context.pos);
    let from = node.from;

    if (node.name !== 'InternalLink' && node.name !== 'InternalPath') {
        const precursor = context.state.sliceDoc(context.pos - 2, context.pos);
        if (precursor === '[[') {
            textBefore = '';
            from = context.pos;
        } else {
            return null;
        }
    } else {
        from = node.from;
        if (node.name === 'InternalLink') {
            const pathNode = node.node.getChild('InternalPath');
            if (pathNode) {
                from = pathNode.from;
            } else {
                from = context.pos;
            }
        }
    }

    const linkMap = context.state.facet(internalLinkMapFacet);
    const nameCounts = new Map<string, number>();
    linkMap.forEach(link => {
        nameCounts.set(link.internalLinkName, (nameCounts.get(link.internalLinkName) || 0) + 1);
    });

    const searchString = textBefore.toLowerCase();
    const options = linkMap
        .filter(link =>
            link.internalLinkName.toLowerCase().includes(searchString) ||
            (link.filePath && link.filePath.toLowerCase().includes(searchString))
        )
        .map(link => {
            const isDuplicate = (nameCounts.get(link.internalLinkName) || 0) > 1;
            if (isDuplicate) {
                return {
                    label: link.filePath || link.internalLinkName,
                    detail: link.internalLinkName,
                    apply: link.filePath || link.internalLinkName,
                };
            }
            return {
                label: link.internalLinkName,
                detail: link.filePath,
                apply: `${link.internalLinkName}`
            };
        });

    if (options.length === 0) return null;

    return {
        from: from,
        options,
        validFor: /^[^\]|]*/,
    };
}

export const editorInternalLinkAutocompletePlugin = autocompletion({
    override: [internalLinkSource],
    icons: false,
});
