import type { Line } from '@lezer/markdown'

/**
 * Continue parsing `line`'s blocks at `to`, after a block that closed mid-line, as lezer's own line advance does: the
 * base moves there (so the rest of the line isn't indented code by its column), and `pos`, `indent` and `next` follow.
 * Setting `pos` alone left `next` on the old character: a `-` or `*` there read as a list marker and the parser looped.
 */
export function resumeLine(line: Line, to: number) {
    line.moveBase(to)
    const pos = line.skipSpace(to)
    line.indent = line.countIndent(pos, line.pos, line.indent)
    line.pos = pos
    line.next = pos === line.text.length ? -1 : line.text.charCodeAt(pos)
}
