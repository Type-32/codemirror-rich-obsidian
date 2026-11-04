import { Facet } from '@codemirror/state'
import type { ActionEntry } from '../../kit'

/** A flat list is one group; nested arrays are visually separated groups. */
export type ToolbarItems = ActionEntry[] | ActionEntry[][]

/**
 * Contribution point for the selection toolbar. Every extension may provide groups; they are shown
 * in precedence order after `selectionToolbar`'s own `items`. Empty groups are dropped, and the
 * toolbar stays hidden when no items remain.
 *
 * ```ts
 * const myButtons = toolbarItems.of([{ id: 'upper', label: 'Uppercase', icon: 'i-lucide-case-upper', run }])
 * ```
 */
export const toolbarItems = Facet.define<ToolbarItems, ActionEntry[][]>({
    combine: values => values
        .flatMap(v => (Array.isArray(v[0]) ? v as ActionEntry[][] : [v as ActionEntry[]]))
        .filter(group => group.length),
})
