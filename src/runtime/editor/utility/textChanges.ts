import { diffChars } from 'diff'

export interface TextChange {
    from: number
    to: number
    insert: string
}

// ponytail: past these, one replacement for the differing middle; raise them if big pastes into tables show up merged badly.
const MAX_DIFFED = 20_000
const MAX_EDITS = 1_000

/**
 * The changes turning `a` into `b` (positions in `a`, plus `at`): what was edited, not a replacement of the whole
 * text. A cursor, or a collaborator's concurrent edit, outside them stays where it is. The common prefix and suffix
 * are trimmed, and the rest is diffed by character (one replacement when it's very long or very different).
 * Insertions sit as far right as an equivalent diff allows, e.g. a table's padding after a cell's spaces rather than
 * against its text, where someone may be typing.
 */
export function textChanges(a: string, b: string, at = 0): TextChange[] {
    let start = 0
    while (start < a.length && start < b.length && a[start] === b[start]) start++
    let end = 0
    while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++
    const before = a.slice(start, a.length - end), after = b.slice(start, b.length - end)
    if (!before && !after) return []
    const parts = before && after && before.length + after.length <= MAX_DIFFED ? diffChars(before, after, { maxEditLength: MAX_EDITS }) : undefined
    if (!parts) return [{ from: at + start, to: at + a.length - end, insert: after }]
    const out: TextChange[] = []
    let pos = at + start
    for (const part of parts) {
        const last = out.at(-1)
        if (part.added) {
            if (last && last.to === pos) last.insert += part.value
            else out.push({ from: pos, to: pos, insert: part.value })
        }
        else if (part.removed) {
            if (last && last.to === pos) last.to += part.value.length
            else out.push({ from: pos, to: pos + part.value.length, insert: '' })
            pos += part.value.length
        }
        else pos += part.value.length
    }
    // `d` + `   |    ` + ` |` is `d ` + `  |     ` + `|`: slide each pure insertion right over the text it starts with.
    out.forEach((c, i) => {
        if (c.from !== c.to) return
        const limit = out[i + 1]?.from ?? at + a.length
        while (c.from < limit && a[c.from - at] === c.insert[0]) {
            c.insert = c.insert.slice(1) + c.insert[0]
            c.from = c.to = c.from + 1
        }
    })
    return out
}
