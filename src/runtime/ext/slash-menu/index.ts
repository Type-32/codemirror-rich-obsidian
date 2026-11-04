import type { Extension } from '@codemirror/state'
import { vueOverlay, type ActionItems } from '../../kit'
import { slashField, slashItems, slashKeymap } from './state'
import SlashMenu from './SlashMenu.vue'

export { slashItems }

const DEFAULT_ITEMS: ActionItems = [
    ['paragraph', 'heading1', 'heading2', 'heading3'],
    ['bulletList', 'orderedList', 'taskList'],
    ['quote', 'callout', 'codeBlock', 'mathBlock', 'table', 'divider'],
]

const overlay = vueOverlay(SlashMenu)

export interface SlashMenuOptions {
    /** Default: text, headings 1–3, lists, quote, callout, code, math, table, divider. `[]` = none. */
    items?: ActionItems
}

/**
 * Block menu opened by typing `/` at line start or after a space (outside code). Typing filters by
 * label/keywords; ↑/↓ select, Enter/Tab run, Escape closes. The chosen action runs where the `/` was.
 */
export function slashMenu(options: SlashMenuOptions = {}): Extension {
    return [slashItems.of(options.items ?? DEFAULT_ITEMS), slashField, slashKeymap, overlay]
}
