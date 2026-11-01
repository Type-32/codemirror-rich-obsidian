import { Facet } from '@codemirror/state'
import type { InternalLink } from '../types/editor-types'

export const internalLinkMapFacet = Facet.define<InternalLink[], InternalLink[]>({
    combine: values => values.length ? values.flat() : [],
});
