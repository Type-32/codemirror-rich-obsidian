import { Facet } from '@codemirror/state'

export const customBracketClosingConfig = Facet.define<boolean, boolean>({
    combine: (values) => ((values.length ? values[0] : true) || false),
})
