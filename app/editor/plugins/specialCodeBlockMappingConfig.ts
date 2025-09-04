import { Facet } from '@codemirror/state'
import type { SpecialCodeBlockMapping } from '~/editor/types'

export const specialCodeBlockMapFacet = Facet.define<SpecialCodeBlockMapping[], SpecialCodeBlockMapping[]>({
    combine: (values) => values.flat(),
})
