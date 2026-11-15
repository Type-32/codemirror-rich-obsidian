import type { BlockContext, LeafBlock, LeafBlockParser, MarkdownConfig } from '@lezer/markdown'

/** `[`, one status character (`u`: an emoji is one character, two UTF-16 units), `]`. */
const MARKER = /^\[.\]/u

class TaskParser implements LeafBlockParser {
    constructor(readonly marker: number) {}

    nextLine() {
        return false
    }

    finish(cx: BlockContext, leaf: LeafBlock) {
        cx.addLeafElement(leaf, cx.elt('Task', leaf.start, leaf.start + leaf.content.length, [
            cx.elt('TaskMarker', leaf.start, leaf.start + this.marker),
            ...cx.parser.parseInline(leaf.content.slice(this.marker), leaf.start + this.marker),
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
        leaf: (cx, leaf) => {
            const marker = MARKER.exec(leaf.content)?.[0].length
            return marker && /[ \t]/.test(leaf.content[marker] ?? '') && cx.parentType().name === 'ListItem' ? new TaskParser(marker) : null
        },
        after: 'SetextHeading',
    }],
}
