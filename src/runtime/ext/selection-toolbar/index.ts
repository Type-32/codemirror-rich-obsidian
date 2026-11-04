import type { Extension } from '@codemirror/state'
import { vueOverlay, type ActionItems } from '../../kit'
import { toolbarItems } from './items'
import SelectionToolbar from './SelectionToolbar.vue'

export { toolbarItems }

const DEFAULT_ITEMS: ActionItems = [['bold', 'italic', 'strikethrough', 'highlight'], ['link', 'wikilink']]

const overlay = vueOverlay(SelectionToolbar)

export interface SelectionToolbarOptions {
    /** Default: `[['bold', 'italic', 'strikethrough', 'highlight'], ['link', 'wikilink']]`. `[]` = none. */
    items?: ActionItems
}

/**
 * Floating formatting toolbar centred above the selection. Appears after a mouse selection is
 * released or a keyboard selection settles, for selections inside one paragraph or heading.
 */
export function selectionToolbar(options: SelectionToolbarOptions = {}): Extension {
    return [toolbarItems.of(options.items ?? DEFAULT_ITEMS), overlay]
}
