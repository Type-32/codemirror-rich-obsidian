import { describe, expect, it } from 'vitest'
import type { EditorState } from '@codemirror/state'
import { slashMenu } from '../src/runtime/ext/slash-menu'
import { closeSlash, slashField, slashMatches } from '../src/runtime/ext/slash-menu/state'
import { editorLabels, label } from '../src/runtime/kit/labels'
import { state } from './helpers'

/** Type `text` at the cursor as user input, one character per transaction. */
function type(s: EditorState, text: string) {
    for (const ch of text) {
        const { head } = s.selection.main
        s = s.update({ changes: { from: head, insert: ch }, selection: { anchor: head + 1 }, userEvent: 'input.type' }).state
    }
    return s
}
const open = (src: string, typed: string) => type(state(src, slashMenu()), typed).field(slashField)

describe('slash menu trigger', () => {
    it('opens on / at line start or after whitespace', () => {
        expect(open('«»', '/')).toMatchObject({ from: 0, query: '' })
        expect(open('word «»', '/')).toMatchObject({ from: 5 })
        expect(open('- «»', '/h')).toMatchObject({ query: 'h' })
    })
    it('does not open mid-word, in code, or for programmatic inserts', () => {
        expect(open('and«»', '/')).toBeNull()
        expect(open('```\n«»\n```', '/')).toBeNull()
        expect(open('a `x«»` b', ' /')).toBeNull()
        const s = state('«»', slashMenu())
        expect(s.update({ changes: { from: 0, insert: '/' }, selection: { anchor: 1 } }).state.field(slashField)).toBeNull()
    })
    it('closes when nothing matches, the slash is deleted, or on Escape', () => {
        expect(open('«»', '/zzzz')).toBeNull()
        let s = type(state('«»', slashMenu()), '/he')
        expect(s.field(slashField)?.query).toBe('he')
        s = s.update({ changes: { from: 0, to: 1 }, selection: { anchor: 0 } }).state
        expect(s.field(slashField)).toBeNull()
        s = type(state('«»', slashMenu()), '/')
        expect(s.update({ effects: closeSlash.of(null) }).state.field(slashField)).toBeNull()
    })
    it('closes when the cursor leaves the /… run', () => {
        const s = type(state('x\n«»', slashMenu()), '/h')
        expect(s.update({ selection: { anchor: 0 } }).state.field(slashField)).toBeNull()
    })
    it('matches keywords, not only labels', () => {
        expect(open('«»', '/h1')).not.toBeNull()
        expect(open('«»', '/todo')).not.toBeNull()
    })
})

describe('editorLabels', () => {
    const labels = [editorLabels.of({ heading1: 'Titel 1', 'ui.x': 'first' }), editorLabels.of({ heading1: 'ignored', bold: 'Fett' })]
    it('merges per key, the first value winning; missing keys fall back', () => {
        const s = state('«»', labels)
        expect([label(s, 'heading1', ''), label(s, 'bold', ''), label(s, 'ui.x', ''), label(s, 'italic', 'Italic')])
            .toEqual(['Titel 1', 'Fett', 'first', 'Italic'])
    })
    it('labels resolved actions and filters by the shown label', () => {
        const s = state('«»', [slashMenu(), labels])
        expect(slashMatches(s, 'titel').flat().map(a => a.label)).toEqual(['Titel 1'])
        expect(slashMatches(s, 'h2').flat().map(a => a.label)).toEqual(['Heading 2'])
    })
})
