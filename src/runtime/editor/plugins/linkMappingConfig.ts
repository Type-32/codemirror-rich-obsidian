import { Facet } from '@codemirror/state'
import type { InternalLink } from '#codemirror-rich-obsidian-editor/editor-types'

export const internalLinkMapFacet = Facet.define<InternalLink[], InternalLink[]>({
    combine: values => values.length ? values.flat() : [],
});
