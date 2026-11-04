import { describe, expect, it } from 'vitest'
import { EditorSelection, EditorState } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { GFM } from '@lezer/markdown'
import type { Command, EditorView } from '@codemirror/view'
import { CustomOFM } from '../src/runtime/editor/lezer-parsers/customOFMParsers'
import { formattableRange, linkAt, markAt, type MarkType } from '../src/runtime/kit/queries'
import { setLink, toggleMark, toggleWikilink } from '../src/runtime/kit/commands'

// Mirrors `markdownConfig()` (wysiwyg.ts imports Vue widgets, which vitest can't load without a plugin).
// @ts-ignore lezer extension typing is looser than lang-markdown's
const lang = markdown({ extensions: [GFM, CustomOFM, { remove: ['SetextHeading'] }] })

function parsed(s: EditorState) {
    ensureSyntaxTree(s, s.doc.length, 5000)
    return s
}

/** `«b»` selects `b`; `«»` is a cursor. */
function state(src: string) {
    const from = src.indexOf('«'), to = src.indexOf('»') - 1
    return parsed(EditorState.create({ doc: src.replace(/[«»]/g, ''), extensions: lang, selection: EditorSelection.single(from, to) }))
}

/** Run `cmd` against a minimal view (commands only read `state` and `dispatch`); returns text + selected text. */
function exec(start: EditorState | string, cmd: Command) {
    let s = typeof start === 'string' ? state(start) : start
    cmd({ get state() { return s }, dispatch: (tr: { state: EditorState }) => { s = parsed(tr.state) } } as unknown as EditorView)
    return { text: s.doc.toString(), sel: s.sliceDoc(s.selection.main.from, s.selection.main.to), state: s }
}

const isActive = (src: string, type: MarkType) => {
    const s = state(src)
    return !!markAt(s, type, s.selection.main.from, s.selection.main.to)
}

describe('markAt', () => {
    it('bold content is bold, not italic', () => {
        expect(isActive('**«x»**', 'bold')).toBe(true)
        expect(isActive('**«x»**', 'italic')).toBe(false)
    })
    it('bold+italic reads as both', () => {
        expect(isActive('***«x»***', 'bold')).toBe(true)
        expect(isActive('***«x»***', 'italic')).toBe(true)
    })
    it('whole node including marks counts', () => {
        expect(isActive('«**x**»', 'bold')).toBe(true)
    })
    it('partial selection does not count', () => {
        expect(isActive('**a«b»c**', 'bold')).toBe(false)
    })
    it('text between two bold runs is not bold', () => {
        expect(isActive('**a**«b»**c**', 'bold')).toBe(false)
    })
})

describe('toggleMark', () => {
    it('wraps and keeps the text selected', () => {
        expect(exec('a «b» c', toggleMark('bold'))).toMatchObject({ text: 'a **b** c', sel: 'b' })
    })
    it('round-trips', () => {
        const once = exec('«b»', toggleMark('highlight'))
        expect(once.text).toBe('==b==')
        expect(exec(once.state, toggleMark('highlight'))).toMatchObject({ text: 'b', sel: 'b' })
    })
    it('italic inside bold wraps instead of eating a bold mark', () => {
        expect(exec('**«x»**', toggleMark('italic')).text).toBe('***x***')
    })
    it('removes only the italic layer of bold+italic', () => {
        expect(exec('***«x»***', toggleMark('italic')).text).toBe('**x**')
    })
    it('acts on every range', () => {
        const s = parsed(EditorState.create({
            doc: 'a b', extensions: [lang, EditorState.allowMultipleSelections.of(true)],
            selection: EditorSelection.create([EditorSelection.range(0, 1), EditorSelection.range(2, 3)]),
        }))
        expect(exec(s, toggleMark('bold')).text).toBe('**a** **b**')
    })
})

describe('links', () => {
    it('wikilink round-trips, keeping the alias on unwrap', () => {
        const once = exec('«note»', toggleWikilink)
        expect(once.text).toBe('[[note]]')
        expect(exec(once.state, toggleWikilink).text).toBe('note')
        expect(exec('«[[path|alias]]»', toggleWikilink).text).toBe('alias')
    })
    it('setLink wraps, edits, and removes', () => {
        expect(exec('«site»', setLink('https://a.b'))).toMatchObject({ text: '[site](https://a.b)', sel: 'site' })
        expect(exec('[«site»](https://a.b)', setLink('https://c.d')).text).toBe('[site](https://c.d)')
        expect(exec('[«site»](https://a.b)', setLink('')).text).toBe('site')
        expect(exec('«x»', setLink('a b')).text).toBe('[x](<a b>)')
    })
    it('linkAt reads an angle-bracket url', () => {
        const s = state('[«site»](<a b>)')
        expect(linkAt(s, s.selection.main.from, s.selection.main.to)?.url).toBe('a b')
    })
})

describe('formattableRange', () => {
    const ok = (src: string) => !!formattableRange(state(src))
    it('accepts a selection inside one paragraph or heading', () => {
        expect(ok('a «b» c')).toBe(true)
        expect(ok('# a «b» c')).toBe(true)
    })
    it('rejects empty, cross-block, code-block, and inline-code selections', () => {
        expect(ok('a «» b')).toBe(false)
        expect(ok('a«b\n\nc»d')).toBe(false)
        expect(ok('```\na«b»c\n```')).toBe(false)
        expect(ok('a `«b»` c')).toBe(false)
    })
})
