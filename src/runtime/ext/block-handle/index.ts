import type { Extension } from '@codemirror/state'
import { vueOverlay } from '../../kit'
import BlockHandle from './BlockHandle.vue'

const overlay = vueOverlay(BlockHandle)

/**
 * Notion-style handle left of the hovered block. Drag to move the block (a list item moves with its
 * children; callouts, tables and code blocks move whole); click for Move up / Move down / Delete.
 */
export function blockDragHandle(): Extension {
    return overlay
}
