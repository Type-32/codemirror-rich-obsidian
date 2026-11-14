import type { BlockContext, LeafBlock, LeafBlockParser, MarkdownConfig } from '@lezer/markdown'

class TaskParser implements LeafBlockParser {
    nextLine() {
        return false
    }

    finish(cx: BlockContext, leaf: LeafBlock) {
        cx.addLeafElement(leaf, cx.elt('Task', leaf.start, leaf.start + leaf.content.length, [
            cx.elt('TaskMarker', leaf.start, leaf.start + 3),
            ...cx.parser.parseInline(leaf.content.slice(3), leaf.start + 3),
        ]))
        return true
    }
}

/**
 * Obsidian task items: any single character between the brackets is a status (`[/]`, `[-]`, `[>]`…),
 * and the marker must be followed by a space or tab (`- [ ]text` is not a task). Replaces GFM's
 * `TaskList` block parser by name; the `Task`/`TaskMarker` nodes come from GFM.
 */
export const lezerTaskListParser: MarkdownConfig = {
    parseBlock: [{
        name: 'TaskList',
        leaf: (cx, leaf) => (/^\[.\][ \t]/.test(leaf.content) && cx.parentType().name === 'ListItem' ? new TaskParser() : null),
        after: 'SetextHeading',
    }],
}
