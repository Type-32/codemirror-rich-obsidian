import type { Extension } from '@codemirror/state'
import { vueOverlay } from '../../kit'
import { toolbarItems, type ToolbarItems } from './items'
import SelectionToolbar from './SelectionToolbar.vue'

export { toolbarItems, type ToolbarItems }

const DEFAULT_ITEMS: ToolbarItems = [['bold', 'italic', 'strikethrough', 'highlight'], ['link', 'wikilink']]

const overlay = vueOverlay(SelectionToolbar)

export interface SelectionToolbarOptions {
    /** Default: `[['bold', 'italic', 'strikethrough', 'highlight'], ['link', 'wikilink']]`. `[]` = none. */
    items?: ToolbarItems
}

/**
 * Floating formatting toolbar centred above the selection. Appears after a mouse selection is
 * released or a keyboard selection settles, for selections inside one paragraph or heading.
 */
export function selectionToolbar(options: SelectionToolbarOptions = {}): Extension {
    return [toolbarItems.of(options.items ?? DEFAULT_ITEMS), overlay]
}
