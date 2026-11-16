// Obsidian-flavored Markdown for comark: `@type32/codemirror-rich-obsidian-editor/comark`. Parses what the editor parses
// (same rules as its Lezer parsers, `test/comark-parity.test.ts` holds that), into nodes hosts map to their components.
import { defineComarkPlugin, type MarkdownExitPlugin } from 'comark'
import { calloutRegex } from '../editor/lezer-parsers/lezerCalloutParser'
import { inlineCommentEnd } from '../editor/lezer-parsers/lezerCommentParser'

// Comark parses with markdown-exit; its `MarkdownItPlugin` type names `markdown-it`, which isn't installed with it.
type MarkdownIt = Parameters<MarkdownExitPlugin>[0]
type InlineRule = Parameters<MarkdownIt['inline']['ruler']['push']>[1]
type BlockRule = Parameters<MarkdownIt['block']['ruler']['push']>[1]
type CoreRule = Parameters<MarkdownIt['core']['ruler']['push']>[1]
type StateCore = Parameters<CoreRule>[0]
type Token = StateCore['tokens'][number]

export interface OfmOptions {
    /**
     * Extra attributes for the `wikilink` or `internal-embed` node whose target is `target` (e.g. `href`, `referenceId`), or
     * nothing when it doesn't resolve. With `InternalLink`s: `target => links.find(l => l.name === target || l.filePath === target)`
     * mapped to the attributes your components read.
     */
    resolveLink?: (target: string) => Record<string, string> | undefined
}

/** The Lezer hashtag parser's label characters (`lezerHashtagParser`). */
const HASHTAG = /^[^\u2000-\u206F\u2E00-\u2E7F'!"#$%&()*+,.:;<=>?@^`{|}~[\]\\\s]+/
/** `noteTargets`' block id: ` ^id` at the end of a paragraph. */
const BLOCK_ID = /\s\^([\w-]+)$/
/** A task item's marker: any one character in brackets, then whitespace (`lezerTaskListParser`). */
const TASK = /^\[(.)\][ \t]+/u

type RuleOptions = { alt?: string[] }

/** Registers `fn` before the first of `anchors` the ruler has, else at the end (comark's own rules may be absent). */
function insert<F>(ruler: { before(anchor: string, name: string, fn: F, options?: RuleOptions): void, push(name: string, fn: F, options?: RuleOptions): void }, anchors: string[], name: string, fn: F, options?: RuleOptions) {
    for (const anchor of anchors) {
        try {
            ruler.before(anchor, name, fn, options)
            return
        }
        catch { /* not registered */ }
    }
    ruler.push(name, fn, options)
}

const attrs = (record: Record<string, string | undefined>): [string, string][] =>
    Object.entries(record).filter((e): e is [string, string] => e[1] !== undefined && e[1] !== '')

/**
 * `[[target#subpath|display]]` → `wikilink`; with `!` → `internal-embed` (Obsidian's class for it; `embed` is an HTML
 * element). Same bounds as `lezerInternalLinkParser`.
 */
const wikilink = (options: OfmOptions): InlineRule => (state, silent) => {
    let pos = state.pos
    const embed = state.src.charCodeAt(pos) === 0x21 /* ! */
    if (embed) pos++
    if (state.src.charCodeAt(pos) !== 0x5B || state.src.charCodeAt(pos + 1) !== 0x5B) return false
    const end = state.src.indexOf(']]', pos + 2)
    if (end < 0 || end + 2 > state.posMax || end === pos + 2) return false
    const inner = state.src.slice(pos + 2, end)
    if (inner.includes('[[')) return false
    const pipe = inner.indexOf('|')
    const path = (pipe < 0 ? inner : inner.slice(0, pipe)).trim()
    const display = pipe < 0 ? undefined : inner.slice(pipe + 1).trim()
    if (!path && !display) return false
    if (!silent) {
        const hash = path.indexOf('#')
        const target = hash < 0 ? path : path.slice(0, hash)
        const node = attrs({ target, subpath: hash < 0 ? undefined : path.slice(hash + 1), display, ...options.resolveLink?.(target) })
        if (embed) {
            state.push('mdc_inline_component', 'internal-embed', 0).attrs = node
        }
        else {
            state.push('mdc_inline_span_open', 'wikilink', 1).attrs = node
            state.push('text', '', 0).content = display || path
            state.push('mdc_inline_span_close', 'wikilink', -1)
        }
    }
    state.pos = end + 2
    return true
}

/** `==text==` → `mark`, its content parsed inline. */
const highlight: InlineRule = (state, silent) => {
    const start = state.pos
    if (state.src.charCodeAt(start) !== 0x3D || state.src.charCodeAt(start + 1) !== 0x3D) return false
    const end = state.src.indexOf('==', start + 2)
    if (end < 0 || end + 2 > state.posMax || end === start + 2) return false
    if (!silent) {
        const max = state.posMax
        state.push('mdc_inline_span_open', 'mark', 1)
        state.pos = start + 2
        state.posMax = end
        state.md.inline.tokenize(state)
        state.posMax = max
        state.push('mdc_inline_span_close', 'mark', -1)
    }
    state.pos = end + 2
    return true
}

/** `#tag/sub` → `hashtag` (`tag: 'tag/sub'`); not all digits (`lezerHashtagParser`). */
const hashtag: InlineRule = (state, silent) => {
    if (state.src.charCodeAt(state.pos) !== 0x23 /* # */) return false
    const label = HASHTAG.exec(state.src.slice(state.pos + 1, state.posMax))?.[0]
    if (!label || !/\D/.test(label)) return false
    if (!silent) {
        state.push('mdc_inline_span_open', 'hashtag', 1).attrs = [['tag', label]]
        state.push('text', '', 0).content = `#${label}`
        state.push('mdc_inline_span_close', 'hashtag', -1)
    }
    state.pos += label.length + 1
    return true
}

/** `%%comment%%` on one line, to the first unescaped `%%`: dropped, as Obsidian's reading view does. */
const inlineComment: InlineRule = (state) => {
    if (state.src.charCodeAt(state.pos) !== 0x25 || state.src.charCodeAt(state.pos + 1) !== 0x25) return false
    const end = inlineCommentEnd(state, state.src, state.pos, state.posMax)
    if (end < 0) return false
    state.pos = end
    return true
}

/** A block starting with `%%`, to the next `%%` (or the end): dropped. A one-line comment with text after it is left inline. */
const blockComment: BlockRule = (state, startLine, endLine, silent) => {
    const lineText = (n: number) => state.src.slice(state.bMarks[n]! + state.tShift[n]!, state.eMarks[n])
    const first = lineText(startLine)
    if (!first.startsWith('%%')) return false
    const close = /(^|[^\\])%%/
    let line = startLine
    let rest = first.slice(2)
    let m = close.exec(rest)
    if (m && rest.slice(m.index + m[0].length).trim()) return false
    while (!m && line + 1 < endLine) {
        rest = lineText(++line)
        m = close.exec(rest)
    }
    if (!silent) state.line = line + 1
    return true
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** The index of the token closing the block opened at `open` (same type family, same level). */
function closing(tokens: Token[], open: number, type: string) {
    for (let i = open + 1; i < tokens.length; i++) if (tokens[i]!.type === type && tokens[i]!.level === tokens[open]!.level) return i
    return -1
}

/**
 * Before inline parsing: callouts become `callout` blocks (`type`, `metadata`, `fold`) with a `callout-title` (the
 * title, or the type when there is none) and `callout-content`; block ids leave the text for `blockId` on their block;
 * task items of any status get `data-task` and a checkbox (comark's own task rule then finds nothing to do).
 */
const blocks = (state: StateCore) => {
    const tokens = state.tokens
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i]!
        if (token.type === 'blockquote_open' && tokens[i + 2]?.type === 'inline') {
            const inline = tokens[i + 2]!
            const [head = '', ...body] = inline.content.split('\n')
            const m = calloutRegex.exec(head)
            const end = m ? closing(tokens, i, 'blockquote_close') : -1
            if (!m || end < 0) continue
            const type = m[1]!.trim().toLowerCase()
            token.type = 'mdc_block_open'
            token.tag = 'callout'
            token.attrs = attrs({ type, metadata: (m[2] ?? '').slice(1), fold: m[3] })
            tokens[end]!.type = 'mdc_block_close'
            tokens[end]!.tag = 'callout'
            inline.content = body.join('\n')
            const title = new state.Token('inline', '', 0)
            title.content = m[4]!.trim() || capitalize(type)
            title.children = []
            const slot = (tag: string) => Object.assign(new state.Token('mdc_block_slot_open', tag, 1), { level: token.level + 1 })
            tokens.splice(i + 1, 0, slot('callout-title'), title, slot('callout-content'))
            continue
        }
        if (token.type !== 'inline') continue
        const id = BLOCK_ID.exec(token.content)
        if (id) {
            token.content = token.content.slice(0, id.index)
            owner(tokens, i)?.attrSet('blockId', id[1]!)
        }
        const task = tokens[i - 1]?.type === 'paragraph_open' && TASK.exec(token.content)
        const item = task ? listItem(tokens, i) : -1
        if (task && item >= 0) {
            token.content = token.content.slice(task[0].length)
            token.meta = { ...token.meta, task: task[1] }
            tokens[item]!.attrSet('class', 'task-list-item')
            tokens[item]!.attrSet('data-task', task[1]!)
            for (let j = item - 1; j >= 0; j--) {
                const list = tokens[j]!
                if ((list.type === 'bullet_list_open' || list.type === 'ordered_list_open') && list.level === tokens[item]!.level - 1) {
                    list.attrSet('class', 'contains-task-list')
                    break
                }
            }
        }
    }
}

/** The list item whose first paragraph holds the inline token at `i`, or -1. */
function listItem(tokens: Token[], i: number) {
    return tokens[i - 2]?.type === 'list_item_open' ? i - 2 : -1
}

/** The block a block id belongs to: the paragraph, or the list item when its paragraph isn't rendered (tight lists). */
function owner(tokens: Token[], i: number): Token | undefined {
    const paragraph = tokens[i - 1]
    if (paragraph?.type !== 'paragraph_open') return undefined
    return paragraph.hidden && tokens[i - 2]?.type === 'list_item_open' ? tokens[i - 2] : paragraph
}

/** After inline parsing: the checkbox of each task item, as comark draws its own. */
const checkboxes = (state: StateCore) => {
    for (const token of state.tokens) {
        const status = token.type === 'inline' ? (token.meta as { task?: string } | null)?.task : undefined
        if (status === undefined) continue
        const box = new state.Token('mdc_inline_component', 'input', 0)
        box.attrs = [['class', 'task-list-item-checkbox'], ['type', 'checkbox'], [':disabled', 'true'], ...(status === ' ' ? [] : [[':checked', 'true'] as [string, string]])]
        token.children = [box, ...(token.children ?? [])]
    }
}

/**
 * Obsidian-flavored Markdown: `[[wikilinks]]` (`wikilink`), `![[embeds]]` (`internal-embed`), `==highlights==` (`mark`), `#tags`
 * (`hashtag`), callouts (`callout` > `callout-title`, `callout-content`), `%%comments%%` (dropped), block ids (`blockId`
 * on their block) and task statuses (`data-task` on the item). Math and footnotes are comark's own plugins.
 */
export const ofm = defineComarkPlugin((options: OfmOptions = {}) => ({
    name: 'ofm',
    markdownItPlugins: [(md: MarkdownIt) => {
        insert(md.inline.ruler, ['comark_inline_span', 'link'], 'ofm_wikilink', wikilink(options))
        insert(md.inline.ruler, ['emphasis'], 'ofm_highlight', highlight)
        insert(md.inline.ruler, ['emphasis'], 'ofm_hashtag', hashtag)
        insert(md.inline.ruler, ['emphasis'], 'ofm_comment', inlineComment)
        // First, and ending paragraphs (as `%%` lines do in the editor): otherwise every comment line first ran the
        // setext-heading rule, which scans to the next paragraph end, and runs of comment blocks took quadratic time.
        insert(md.block.ruler, ['table', 'code', 'paragraph'], 'ofm_comment', blockComment, { alt: ['paragraph', 'reference', 'blockquote', 'list'] })
        insert(md.core.ruler, ['task-lists-mdc', 'inline'], 'ofm_blocks', blocks)
        md.core.ruler.after('inline', 'ofm_checkboxes', checkboxes)
    }],
}))

export default ofm
