import { describe, expect, it } from 'vitest'
import type { Extension, Transaction, TransactionSpec } from '@codemirror/state'
import { history, undo } from '@codemirror/commands'
import { EditorView } from '@codemirror/view'
import { acceptProposal, aiField, discardProposal, openAi, propose, refreshProposal } from '../src/runtime/ext/ai/state'
import { buildPrompt, cleanOutput, contextAround, cursorPresets } from '../src/runtime/ext/ai/prompt'
import { runEditorTool } from '../src/runtime/ext/ai/run-tool'
import { parsed, state } from './helpers'

/** A view stand-in over `src` with the AI field; records every transaction. */
function editor(src: string, extensions: Extension = [aiField, history()]) {
    let s = state(src, extensions)
    const log: Transaction[] = []
    const view = {
        get state() { return s },
        dispatch: (spec: TransactionSpec | Transaction) => {
            const tr = 'startState' in spec ? spec : s.update(spec)
            log.push(tr)
            s = parsed(tr.state)
        },
    } as unknown as EditorView
    const queue = () => s.field(aiField)
    return { view, log, queue, get text() { return s.doc.toString() } }
}

describe('AI proposals', () => {
    it('track their target through edits; editing inside makes them stale', () => {
        const ed = editor('The «quick» fox.')
        openAi(ed.view)
        const [p] = ed.queue()
        expect(p).toMatchObject({ from: 4, to: 9, mode: 'replace', source: 'action', stale: false })

        ed.view.dispatch({ changes: { from: 0, insert: 'Oh. ' } })
        expect(ed.queue()[0]).toMatchObject({ from: 8, to: 13, stale: false })
        ed.view.dispatch({ changes: { from: 13, insert: ' brown' } }) // at the end boundary: outside
        expect(ed.queue()[0]).toMatchObject({ from: 8, to: 13, stale: false })

        ed.view.dispatch({ changes: { from: 10, to: 11, insert: 'I' } })
        expect(ed.queue()[0]!.stale).toBe(true)
        expect(acceptProposal(ed.view, p!.id, 'slow')).toBe(false)
        expect(ed.text).toBe('Oh. The quIck brown fox.')

        ed.view.dispatch({ effects: refreshProposal.of(p!.id) })
        expect(acceptProposal(ed.view, p!.id, 'slow')).toBe(true)
        expect(ed.text).toBe('Oh. The slow brown fox.')
    })

    it('accepting is one input.ai transaction that a single undo reverts', async () => {
        const ed = editor('The «quick» fox.')
        const result = propose(ed.view, { from: 4, to: 9, mode: 'replace', text: 'sly' })
        const id = ed.queue()[0]!.id
        const before = ed.log.length
        expect(acceptProposal(ed.view, id, 'clever')).toBe(true)
        expect(ed.log.length - before).toBe(1)
        expect(ed.log.at(-1)!.isUserEvent('input.ai')).toBe(true)
        expect(ed.text).toBe('The clever fox.')
        expect(ed.queue()).toEqual([])
        await expect(result).resolves.toEqual({ status: 'accepted', text: 'clever' })
        undo(ed.view)
        expect(ed.text).toBe('The quick fox.')
    })

    it('discarding leaves the document alone and rejects the tool call', async () => {
        const ed = editor('a «b» c')
        const result = propose(ed.view, { from: 2, to: 3, mode: 'replace', text: 'x' })
        discardProposal(ed.view, ed.queue()[0]!.id)
        expect(ed.text).toBe('a b c')
        expect(ed.queue()).toEqual([])
        await expect(result).resolves.toEqual({ status: 'rejected' })
    })

    it('user actions go first and replace each other; tool proposals queue in order', () => {
        const ed = editor('one «two» three')
        propose(ed.view, { from: 0, to: 3, mode: 'replace', text: 'A' })
        propose(ed.view, { from: 10, to: 15, mode: 'replace', text: 'B' })
        openAi(ed.view)
        openAi(ed.view, cursorPresets[0])
        expect(ed.queue().map(p => [p.source, p.text ?? p.instruction])).toEqual([
            ['action', cursorPresets[0]!.instruction], ['tool', 'A'], ['tool', 'B'],
        ])
    })

    it('block and reference results go below the cursor line as their own block', () => {
        const ed = editor('Intro«»\nnext')
        openAi(ed.view, cursorPresets.find(p => p.mode === 'block'))
        acceptProposal(ed.view, ed.queue()[0]!.id, '- a\n- b')
        expect(ed.text).toBe('Intro\n\n- a\n- b\n\nnext')
    })

    it('openAi is a no-op without the assistant or in a read-only editor', () => {
        expect(openAi(editor('x', []).view)).toBe(false)
        expect(openAi(editor('x', [aiField, EditorView.editable.of(false)]).view)).toBe(false)
    })
})

describe('editor tools', () => {
    it('proposeEdit needs a passage that occurs exactly once', async () => {
        const ed = editor('cat dog cat')
        expect(await runEditorTool(ed.view, { toolName: 'proposeEdit', input: { find: 'cat', replace: 'x' } })).toHaveProperty('error')
        expect(await runEditorTool(ed.view, { toolName: 'proposeEdit', input: { find: 'bird', replace: 'x' } })).toHaveProperty('error')
        expect(await runEditorTool(ed.view, { toolName: 'proposeEdit', input: { find: '', replace: 'x' } })).toHaveProperty('error')
        expect(await runEditorTool(ed.view, { toolName: 'proposeEdit', input: { find: 1 } })).toHaveProperty('error')
        expect(ed.queue()).toEqual([])

        const result = runEditorTool(ed.view, { toolName: 'proposeEdit', input: { find: 'dog', replace: 'cow' } })
        expect(ed.queue()[0]).toMatchObject({ from: 4, to: 7, text: 'cow', source: 'tool' })
        acceptProposal(ed.view, ed.queue()[0]!.id, 'cow')
        await expect(result).resolves.toEqual({ status: 'accepted', text: 'cow' })
        expect(ed.text).toBe('cat cow cat')
    })

    it('proposeInsert goes after a unique passage, else at the cursor', () => {
        const ed = editor('one two«» three')
        runEditorTool(ed.view, { toolName: 'proposeInsert', input: { text: '!', after: 'one' } })
        runEditorTool(ed.view, { toolName: 'proposeInsert', input: { text: '?' } })
        expect(ed.queue().map(p => [p.from, p.to, p.mode])).toEqual([[3, 3, 'insert'], [7, 7, 'insert']])
    })

    it('proposals fail with a reason when the assistant is not enabled; reads still work', async () => {
        const ed = editor('hello «world»', [])
        expect(await runEditorTool(ed.view, { toolName: 'proposeInsert', input: { text: 'x' } })).toHaveProperty('error')
        expect(await runEditorTool(ed.view, { toolName: 'readSelection', input: {} })).toMatchObject({ text: 'world', before: 'hello ', after: '' })
        expect(await runEditorTool(ed.view, { toolName: 'readDocument', input: {} })).toEqual({ markdown: 'hello world' })
        expect(await runEditorTool(ed.view, { toolName: 'nope', input: {} })).toHaveProperty('error')
    })
})

describe('prompt', () => {
    it('includes the outline with the current section, the selection and the output rule', () => {
        const s = state('# Doc\n\n## Intro\n\nSome «text» here.\n\n## End')
        const prompt = buildPrompt(s, { from: s.selection.main.from, to: s.selection.main.to, mode: 'replace' }, 'Shorten it.')
        expect(prompt).toContain('Task: Shorten it.')
        expect(prompt).toContain('  - Intro  ← current section')
        expect(prompt).toContain('Selected text:\n<<<\ntext\n>>>')
        expect(prompt).toContain('replaces the selected text')
        expect(buildPrompt(s, { from: 5, to: 5, mode: 'insert' }, 'Go on.')).toContain('[cursor is here]')
    })

    it('context windows are cut back to whole blocks', () => {
        const para = (c: string) => c.repeat(400)
        const doc = [para('a'), para('b'), para('c'), para('d'), 'TARGET', para('e'), para('f')].join('\n\n')
        const from = doc.indexOf('TARGET')
        const { before, after } = contextAround(state(doc), from, from + 6)
        expect(before.startsWith('b')).toBe(true) // 'a…' was cut mid-paragraph, so it is dropped
        expect(before.endsWith('d\n\n')).toBe(true)
        expect(after).toBe(`\n\n${'e'.repeat(400)}`) // 'f…' is cut mid-paragraph, so it is dropped
    })

    it('cleanOutput drops a wrapping fence and keeps a space after a word', () => {
        expect(cleanOutput('```markdown\n**hi**\n```\n', 'replace')).toBe('**hi**')
        expect(cleanOutput('```js\na\n```\ntext\n```\nb\n```', 'replace')).toBe('```js\na\n```\ntext\n```\nb\n```')
        expect(cleanOutput('sat down.', 'insert', 't')).toBe(' sat down.')
        expect(cleanOutput(', then left.', 'insert', 't')).toBe(', then left.')
        expect(cleanOutput('Next.', 'insert', ' ')).toBe('Next.')
    })
})
