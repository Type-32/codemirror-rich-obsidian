import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseMarkdown, type Node } from 'comark'
import math from 'comark/plugins/math'
import { ofm } from '../src/runtime/comark'
import { parseMarkdownToAST } from '../src/runtime/utils/markdownParser'
import { parseCallout } from '../src/runtime/editor/plugins/codemirror-widgets/proseCalloutWidget'

const dir = join(__dirname, 'fixtures/ofm')
const fixtures = readdirSync(dir).filter(f => f.endsWith('.md'))

/** OFM constructs the editor's parser finds, as `kind:value`. Callout titles are parsed apart, as their nested editors do. */
function lezer(text: string): string[] {
    const out: string[] = []
    parseMarkdownToAST(text).iterate({
        enter(n) {
            const slice = (from: number, to: number) => text.slice(from, to)
            const path = (link: typeof n.node) => slice(link.getChild('InternalPath')?.from ?? 0, link.getChild('InternalPath')?.to ?? 0)
            if (n.name === 'InternalLink' && n.node.parent?.name !== 'Embed') out.push(`link:${path(n.node)}`)
            else if (n.name === 'Embed') out.push(`embed:${path(n.node.getChild('InternalLink')!)}`)
            else if (n.name === 'HashtagTagLabel') out.push(`tag:${slice(n.from, n.to)}`)
            else if (n.name === 'Mark') out.push('mark')
            else if (n.name === 'TaskMarker') out.push(`task:${slice(n.from + 1, n.to - 1)}`)
            else if (n.name === 'Callout') {
                const callout = parseCallout(slice(n.from, n.to))!
                out.push(`callout:${callout.type}`, ...lezer(callout.title))
            }
            else if (n.name === 'Comment') return false
        },
    })
    return out.sort()
}

/** The same constructs in comark's document. */
function comark(nodes: Node[]): string[] {
    const out: string[] = []
    const walk = (node: Node) => {
        if (!Array.isArray(node) || node[0] === null) return
        const [tag, attrs] = node as [string, Record<string, string>]
        if (tag === 'wikilink') out.push(`link:${attrs.target ?? ''}`)
        else if (tag === 'internal-embed') out.push(`embed:${attrs.target}`)
        else if (tag === 'hashtag') out.push(`tag:${attrs.tag}`)
        else if (tag === 'mark') out.push('mark')
        else if (tag === 'callout') out.push(`callout:${attrs.type}`)
        else if (tag === 'li' && attrs['data-task'] !== undefined) out.push(`task:${attrs['data-task']}`)
        ;(node.slice(2) as Node[]).forEach(walk)
    }
    nodes.forEach(walk)
    return out.sort()
}

describe('comark plugin parses what the editor parses', () => {
    it.each(fixtures)('%s', async (file) => {
        const text = readFileSync(join(dir, file), 'utf8')
        const doc = await parseMarkdown(text, { plugins: [math(), ofm()] })
        expect(comark(doc.nodes)).toEqual(lezer(text))
        // Comments render as nothing.
        expect(JSON.stringify(doc.nodes)).not.toMatch(/%%|Hidden link|hiddentag|hidden inline/)
    })

    it('covers every construct across the fixtures', () => {
        const kinds = new Set(fixtures.flatMap(f => lezer(readFileSync(join(dir, f), 'utf8')).map(c => c.split(':')[0])))
        expect([...kinds].sort()).toEqual(['callout', 'embed', 'link', 'mark', 'tag', 'task'])
    })
})
