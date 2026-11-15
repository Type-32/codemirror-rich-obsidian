import { describe, expect, it } from 'vitest'
import { linkSuggestions, type NoteTargets } from '../src/runtime/editor/utility/linkSearch'
import type { InternalLink } from '../src/runtime/editor/types/editor-types'

const link = (name: string, more: Partial<InternalLink> = {}): InternalLink => ({ name, referenceId: name, ...more })
const LINKS = [
    link('Notes on Lab', { filePath: 'a/notes-on-lab.md' }),
    link('Collaboration'),
    link('Lab', { aliases: ['Laboratory notes'], headings: ['Setup', 'Results', 'Results 2'], blocks: [{ id: 'abc', text: 'A key finding' }] }),
    link('Laboratory'),
    link('My Note', { filePath: 'x/my-note.md' }),
    link('Note', { filePath: 'a/Note.md' }),
    link('Note', { filePath: 'b/Note.md' }),
    link('Archive', { filePath: 'lab/archive.md' }),
]
const HERE: NoteTargets = { headings: ['Intro', 'Methods'], blocks: [{ id: 'q1', text: 'Question one' }] }
const suggest = (q: string) => linkSuggestions(q, LINKS, () => HERE)
const labels = (q: string) => suggest(q).map(s => s.label)

describe('link suggestions', () => {
    it('rank notes: exact, prefix, word start, inside a name, path, fuzzy; shorter first', () => {
        expect(labels('lab')).toEqual(['Lab', 'Laboratory', 'Laboratory notes', 'Notes on Lab', 'Collaboration', 'Archive'])
        expect(labels('mnt')).toEqual(['My Note'])
        expect(labels('zzz')).toEqual([])
    })

    it('offer every note and alias for an empty query, in link-map order (no cap)', () => {
        const many = Array.from({ length: 500 }, (_, i) => link(`n${i}`))
        expect(linkSuggestions('', many, () => HERE)).toHaveLength(500)
        expect(labels('').slice(0, 4)).toEqual(['Notes on Lab', 'Collaboration', 'Lab', 'Laboratory notes'])
    })

    it('complete shared names to their path, and aliases to `name|alias`', () => {
        expect(suggest('note').filter(s => s.label === 'Note').map(s => s.insert)).toEqual(['a/Note.md', 'b/Note.md'])
        expect(suggest('laboratory n')[0]).toMatchObject({ kind: 'alias', label: 'Laboratory notes', detail: 'Lab', insert: 'Lab|Laboratory notes' })
    })

    it('offer a note\'s headings after `name#` and blocks after `name#^`, written with the note\'s own name', () => {
        expect(suggest('lab#res').map(s => s.insert)).toEqual(['Lab#Results', 'Lab#Results 2'])
        expect(suggest('Lab#^key')).toEqual([{ kind: 'block', label: 'A key finding', detail: '^abc', insert: 'Lab#^abc' }])
        expect(suggest('Nope#x')).toEqual([])
    })

    it('offer this note\'s headings and blocks after `#` and `#^`', () => {
        expect(suggest('#').map(s => s.insert)).toEqual(['#Intro', '#Methods'])
        expect(suggest('#^que').map(s => s.insert)).toEqual(['#^q1'])
    })
})
