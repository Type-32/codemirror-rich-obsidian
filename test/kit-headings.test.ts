import { describe, expect, it } from 'vitest'
import { headingAt, headings, headingsField } from '../src/runtime/kit/headings'
import { useDocumentUtils } from '../src/runtime/composables/useDocumentUtils'
import { parsed, state } from './helpers'

const DOC = '# Title\n\nIntro\n\n## Part *one* ##\n\n> # quoted\n\n- # in list\n\n### Deep\ntext'
const at = (s: string) => DOC.indexOf(s)

describe('headings', () => {
    it('lists top-level ATX headings with level, text (closing #s dropped) and line position', () => {
        expect(headings(state(DOC))).toEqual([
            { level: 1, text: 'Title', from: 0 },
            { level: 2, text: 'Part *one*', from: at('## Part') },
            { level: 3, text: 'Deep', from: at('### Deep') },
        ])
    })

    it('headingsField follows edits', () => {
        const s = parsed(state(DOC, headingsField).update({ changes: { from: 0, insert: '## New\n\n' } }).state)
        expect(s.field(headingsField).map(h => [h.level, h.text, h.from])).toEqual([
            [2, 'New', 0], [1, 'Title', 8], [2, 'Part *one*', at('## Part') + 8], [3, 'Deep', at('### Deep') + 8],
        ])
    })

    it('headingAt is the section containing pos', () => {
        const s = state(DOC)
        expect(headingAt(s, at('Intro'))?.text).toBe('Title')
        expect(headingAt(s, at('text'))?.text).toBe('Deep')
        expect(headingAt(state('before\n# A'), 0)).toBeNull()
    })

    it('getTableOfContents returns the same outline for a plain string', () => {
        expect(useDocumentUtils().getTableOfContents(DOC)).toEqual(headings(state(DOC)))
    })
})
