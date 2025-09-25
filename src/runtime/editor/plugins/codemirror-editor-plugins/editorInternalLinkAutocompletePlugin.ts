import {autocompletion, type Completion, type CompletionContext, type CompletionResult} from "@codemirror/autocomplete";
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
        nameCounts.set(link.name, (nameCounts.get(link.name) || 0) + 1);
    });

    const searchString = textBefore.toLowerCase();
    const options = linkMap
        .filter(link =>
            (link.name && link.name.toLowerCase().includes(searchString)) ||
            (link.filePath && link.filePath.toLowerCase().includes(searchString))
        )
        .map(link => {
            if (!link.name) return null;
            const isDuplicate = (nameCounts.get(link.name) || 0) > 1;
            if (isDuplicate) {
                return {
					label: link.name,
					detail: link.filePath,
					apply: link.filePath || link.name,
				}
            }
            return {
                label: link.name,
                detail: link.filePath,
                apply: `${link.name}`
            };
        }).filter(Boolean);

    if (options.length === 0) return null;

    return {
        from: from,
        options: options as Completion[] || [],
        validFor: /^[^\]|]*/,
    };
}

export const editorInternalLinkAutocompletePlugin = autocompletion({
    override: [internalLinkSource],
    icons: false,
});
