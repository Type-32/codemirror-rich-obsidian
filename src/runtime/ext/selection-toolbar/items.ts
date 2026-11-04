import { defineItemsFacet } from '../../kit'

/**
 * Contribution point for the selection toolbar. Every extension may provide groups; they are shown
 * in precedence order after `selectionToolbar`'s own `items`. The toolbar stays hidden when no items remain.
 *
 * ```ts
 * const myButtons = toolbarItems.of([{ id: 'upper', label: 'Uppercase', icon: 'i-lucide-case-upper', run }])
 * ```
 */
export const toolbarItems = defineItemsFacet()
