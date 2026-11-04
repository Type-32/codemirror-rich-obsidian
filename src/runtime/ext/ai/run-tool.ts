import { EditorView } from '@codemirror/view'
import type { EditorToolName } from './tools'
import { contextAround } from './prompt'
import { aiField, propose } from './state'

type Input = Record<string, unknown>
type Executor = (view: EditorView, input: Input) => unknown

const str = (v: unknown) => (typeof v === 'string' ? v : undefined)

/** Position of the single occurrence of `text`, or an error the model can act on. */
function locate(view: EditorView, text: string): { from: number } | { error: string } {
    const doc = view.state.doc.toString()
    const from = doc.indexOf(text)
    if (!text || from < 0) return { error: 'Passage not found. Copy it exactly as it appears in the document (see readDocument).' }
    if (doc.indexOf(text, from + 1) >= 0) return { error: 'Passage occurs more than once. Include more surrounding words so it matches exactly once.' }
    return { from }
}

/** Why the editor can't take proposals right now, if it can't. */
function unavailable(view: EditorView) {
    if (!view.state.field(aiField, false)) return { error: 'The editor has no AI assistant enabled; proposals cannot be shown.' }
    if (!view.state.facet(EditorView.editable)) return { error: 'The document is read-only.' }
    return null
}

const executors: Record<EditorToolName, Executor> = {
    readDocument: view => ({ markdown: view.state.doc.toString() }),
    readSelection: (view) => {
        const { from, to } = view.state.selection.main
        return { text: view.state.sliceDoc(from, to), ...contextAround(view.state, from, to) }
    },
    proposeEdit: (view, input) => {
        const find = str(input.find), replace = str(input.replace)
        if (find === undefined || replace === undefined) return { error: '`find` and `replace` must be strings.' }
        const blocked = unavailable(view)
        if (blocked) return blocked
        const at = locate(view, find)
        if ('error' in at) return at
        return propose(view, { from: at.from, to: at.from + find.length, mode: 'replace', text: replace })
    },
    proposeInsert: (view, input) => {
        const text = str(input.text), after = str(input.after)
        if (text === undefined) return { error: '`text` must be a string.' }
        const blocked = unavailable(view)
        if (blocked) return blocked
        let pos = view.state.selection.main.head
        if (after !== undefined) {
            const at = locate(view, after)
            if ('error' in at) return at
            pos = at.from + after.length
        }
        return propose(view, { from: pos, to: pos, mode: 'insert', text })
    },
}

/** Whether `toolCall` is one of `editorTools` (and should go to `runEditorTool`). */
export function isEditorTool<T extends { toolName: string }>(toolCall: T): toolCall is T & { toolName: EditorToolName } {
    return Object.hasOwn(executors, toolCall.toolName)
}

/**
 * Run an `editorTools` call against `view`. Reads resolve at once; proposals resolve when the user
 * accepts or rejects them (`{ status, text? }`). Invalid input resolves to `{ error }` for the model.
 * Call from `useChat`'s `onToolCall` and pass the result to `addToolOutput` — without awaiting it
 * inside `onToolCall`.
 */
export async function runEditorTool(view: EditorView, toolCall: { toolName: string, input: unknown }): Promise<unknown> {
    if (!isEditorTool(toolCall)) return { error: `Unknown tool ${toolCall.toolName}.` }
    const input = toolCall.input && typeof toolCall.input === 'object' ? toolCall.input as Input : {}
    return executors[toolCall.toolName](view, input)
}
