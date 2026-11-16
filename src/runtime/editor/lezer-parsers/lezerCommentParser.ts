import type { MarkdownConfig } from '@lezer/markdown'
import { resumeLine } from './resumeLine'

/** The first `%%` in `text[from, end)` not escaped by a backslash; one right at `from` counts unless `escapable`. */
function closeOf(text: string, from: number, end = text.length, escapable = false) {
    for (let i = text.indexOf('%%', from); i >= 0 && i + 2 <= end; i = text.indexOf('%%', i + 1))
        if ((i === from && !escapable) || text.charCodeAt(i - 1) !== 92 /* \ */) return i
    return -1
}

/**
 * Where an inline context's last failed `%%` scan ended. A later `%%` before that has no close either (its candidates
 * are a subset), so a line of unclosable `\%%`s is scanned once, not once per `%%`.
 */
const noClose = new WeakMap<object, number>()

/** The end of the inline comment opening at `from` in `text` (on its line, before `max`), or -1. */
export function inlineCommentEnd(context: object, text: string, from: number, max = text.length) {
    if (from < (noClose.get(context) ?? -1)) return -1
    const eol = text.indexOf('\n', from), end = eol < 0 || eol > max ? max : eol
    // At least one character of content, and the close unescaped: `%%%%%` is a comment of `%`.
    const close = closeOf(text, from + 3, end, true)
    if (close < 0) noClose.set(context, end)
    return close < 0 ? -1 : close + 2
}

/**
 * Obsidian comments, `%%…%%` (same rules as the `/comark` plugin): a block starting with `%%` runs to the next `%%`
 * (or the end); a one-line `%%…%%` followed by text is an inline comment in its paragraph, ending at the first `%%`.
 * Replaces `lezer-markdown-obsidian`'s `Comment`, which hung on two comments on one line (`%%a%% %%b%%`).
 */
export const lezerCommentParser: MarkdownConfig = {
    defineNodes: ['Comment', 'CommentMarker'],
    parseBlock: [{
        name: 'CommentBlock',
        endLeaf: (_, line) => line.text.startsWith('%%', line.pos),
        parse(cx, line) {
            if (!line.text.startsWith('%%', line.pos)) return false
            const start = cx.lineStart + line.pos
            let close = closeOf(line.text, line.pos + 2)
            if (close >= 0 && line.text.slice(close + 2).trim()) return false
            while (close < 0 && cx.nextLine()) close = closeOf(line.text, 0)
            const markers = [cx.elt('CommentMarker', start, start + 2)]
            if (close < 0) {
                cx.addElement(cx.elt('Comment', start, cx.lineStart + line.text.length, markers))
                return true
            }
            const end = cx.lineStart + close + 2
            markers.push(cx.elt('CommentMarker', end - 2, end))
            cx.addElement(cx.elt('Comment', start, end, markers))
            // Text after a multi-line comment's close is parsed as blocks.
            if (line.text.slice(close + 2).trim()) resumeLine(line, close + 2)
            else cx.nextLine()
            return true
        },
    }],
    parseInline: [{
        name: 'CommentInline',
        parse(cx, next, pos) {
            if (next !== 37 /* % */ || cx.char(pos + 1) !== 37) return -1
            const end = cx.offset + inlineCommentEnd(cx, cx.text, pos - cx.offset)
            if (end < cx.offset) return -1
            return cx.addElement(cx.elt('Comment', pos, end, [cx.elt('CommentMarker', pos, pos + 2), cx.elt('CommentMarker', end - 2, end)]))
        },
    }],
}
