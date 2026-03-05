import type { InternalLinkNode } from '../editor/types/editor-types'

/**
 * Fast string-scanner implementation mirroring the exact rules of lezerInternalLinkParser.ts:
 * - Matches [[ ... ]] and ![[...]] (embeds are included as regular links)
 * - Disallows nested [[
 * - Skips empty [[]]
 * - Splits path on # for subpath
 * - Splits on | for display alias
 * - Skips over fenced code blocks (``` or ~~~) and inline code (`...`)
 *   to avoid matching [[ inside code
 */
export function getInternalLinks(markdownText: string): InternalLinkNode[] {
    const links: InternalLinkNode[] = []
    const len = markdownText.length
    let i = 0

    while (i < len) {
        const ch = markdownText[i]

        // Skip fenced code blocks: ``` or ~~~
        if ((ch === '`' || ch === '~') &&
            markdownText[i + 1] === ch &&
            markdownText[i + 2] === ch) {
            const fence = markdownText.slice(i, i + 3)
            const end = markdownText.indexOf('\n' + fence, i + 3)
            i = end === -1 ? len : end + 4 // skip past closing fence + newline
            continue
        }

        // Skip inline code: `...`
        if (ch === '`') {
            const end = markdownText.indexOf('`', i + 1)
            i = end === -1 ? len : end + 1
            continue
        }

        // Detect ![[embed]] — skip the '!' and treat rest as [[link]]
        const isEmbed = ch === '!' &&
            markdownText[i + 1] === '[' &&
            markdownText[i + 2] === '['

        // Detect [[link]]
        const isLink = !isEmbed &&
            ch === '[' &&
            markdownText[i + 1] === '['

        if (!isEmbed && !isLink) {
            i++
            continue
        }

        // Start of the [[ content
        const linkStart = isEmbed ? i + 1 : i
        const contentStart = linkStart + 2 // skip [[

        // Find closing ]] while disallowing nested [[
        let endPos = -1
        let hasNestedOpen = false
        for (let j = contentStart; j < len - 1; j++) {
            if (markdownText[j] === '[' && markdownText[j + 1] === '[') {
                hasNestedOpen = true
                break
            }
            if (markdownText[j] === ']' && markdownText[j + 1] === ']') {
                endPos = j
                break
            }
        }

        // Invalid: no closing ]], nested [[, or empty [[]]
        if (endPos === -1 || hasNestedOpen || endPos === contentStart) {
            i = isEmbed ? i + 1 : i + 2
            continue
        }

        const inner = markdownText.slice(contentStart, endPos)

        // Split on first | for display alias
        const pipeIdx = inner.indexOf('|')
        const pathRaw = pipeIdx === -1 ? inner : inner.slice(0, pipeIdx)
        const display = pipeIdx === -1 ? undefined : inner.slice(pipeIdx + 1).trim() || undefined

        // Split path on first # for subpath
        const hashIdx = pathRaw.indexOf('#')
        const path = (hashIdx === -1 ? pathRaw : pathRaw.slice(0, hashIdx)).trim()
        const subpath = hashIdx === -1 ? undefined : pathRaw.slice(hashIdx).trim() || undefined

        if (path) {
            const link: InternalLinkNode = { path }
            if (subpath) link.subpath = subpath
            if (display) link.display = display
            links.push(link)
        }

        // Advance past the closing ]]
        i = endPos + 2
    }

    return links
}
