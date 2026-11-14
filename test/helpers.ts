import { EditorSelection, EditorState, type Extension } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import type { Command, EditorView } from '@codemirror/view'
import { markdownConfig } from '../src/runtime/editor/wysiwyg'

// The editor's own parser config (fenced-code languages aside).
// @ts-ignore lezer extension typing is looser than lang-markdown's
export const lang = markdown(markdownConfig())

export function parsed(s: EditorState) {
    ensureSyntaxTree(s, s.doc.length, 5000)
    return s
}

/** `«b»` selects `b`; `«»` is a cursor; no markers = cursor at 0. */
export function state(src: string, extensions: Extension = []) {
    const from = Math.max(src.indexOf('«'), 0), to = src.includes('»') ? src.indexOf('»') - 1 : from
    return parsed(EditorState.create({
        doc: src.replace(/[«»]/g, ''),
        extensions: [lang, extensions],
        selection: EditorSelection.single(from, to),
    }))
}

/** Run `cmd` against a minimal view (commands only read `state` and `dispatch`); returns text + selected text. */
export function exec(start: EditorState | string, cmd: Command) {
    let s = typeof start === 'string' ? state(start) : start
    const ok = cmd({ get state() { return s }, dispatch: (tr: { state: EditorState } | object) => {
        s = parsed('state' in tr ? tr.state : s.update(tr).state)
    } } as unknown as EditorView)
    return { ok, text: s.doc.toString(), sel: s.sliceDoc(s.selection.main.from, s.selection.main.to), state: s }
}
