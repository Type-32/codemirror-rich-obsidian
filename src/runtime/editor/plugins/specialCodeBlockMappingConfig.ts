import { Facet } from '@codemirror/state'
import type { SpecialCodeBlockMapping } from '../types/editor-types'

export const specialCodeBlockMapFacet = Facet.define<SpecialCodeBlockMapping[], SpecialCodeBlockMapping[]>({
    combine: (values) => values.flat(),
})
