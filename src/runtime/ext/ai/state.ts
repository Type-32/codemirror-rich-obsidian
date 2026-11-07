import { Facet, Prec, StateEffect, StateField, type ChangeDesc, type TransactionSpec } from '@codemirror/state'
import { Decoration, EditorView, keymap, type DecorationSet } from '@codemirror/view'
import { blockInsertion } from '../../kit'
import type { AiPreset, ProposalMode } from './prompt'

/** An OpenAI-compatible API, e.g. `{ baseURL: 'http://localhost:11434/v1', model: 'llama3.2' }`. */
export interface AiEndpoint {
    baseURL: string
    model: string
    apiKey?: string
    headers?: Record<string, string>
    /** Custom transport for the requests, e.g. a desktop app routing them through its native side. Default `globalThis.fetch`. */
    fetch?: typeof globalThis.fetch
    /** System prompt sent with every request. */
    system?: string
}

/** The module's server route, which calls the endpoint configured in `cmOfmEditor.ai` (nuxt.config). */
export const AI_ROUTE = '/api/_cm-editor/ai'

export interface AiAssistantOptions {
    /**
     * Route answering ai-sdk `useCompletion` requests (`{ prompt, preset, mode, ...body }`) with
     * `toUIMessageStreamResponse()`. Default `AI_ROUTE`, served by the module from `cmOfmEditor.ai`.
     */
    api?: string
    /** Request headers for `api`. */
    headers?: Record<string, string>
    /** Extra JSON merged into every `api` request body. */
    body?: Record<string, unknown>
    /**
     * Call this endpoint from the browser (or through `endpoint.fetch`) instead of `api`. Anyone
     * using the page can read `apiKey` and the endpoint must allow the page's origin (CORS): meant
     * for local models and keys the user supplies. Takes precedence over `api`.
     */
    endpoint?: AiEndpoint
    /** Presets offered on a selection / at a cursor (also the slash items). Default: `selectionPresets` / `cursorPresets`. */
    presets?: { selection?: AiPreset[], cursor?: AiPreset[] }
    /** Add an "Ask AI" button to the selection toolbar. Default `true`. */
    toolbar?: boolean
    /** Add AI items to the slash menu. Default `true`. */
    slash?: boolean
    /** Key opening the AI panel, CodeMirror key notation. Default `'Mod-j'`; `false` = none. */
    shortcut?: string | false
}

/** Options of the configured `aiAssistant()`; the first (highest-precedence) value wins. */
export const aiOptions = Facet.define<AiAssistantOptions, AiAssistantOptions>({ combine: v => v[0] ?? {} })

/** A pending AI result for [from, to]. Nothing reaches the document until it is accepted. */
export interface Proposal {
    id: number
    from: number
    to: number
    mode: ProposalMode
    /** `action`: invoked by the user, streamed by the panel. `tool`: proposed by a host chat, `text` given. */
    source: 'action' | 'tool'
    instruction: string
    preset?: string
    text?: string
    /** The target text was edited after the proposal opened; accepting would overwrite that edit. */
    stale: boolean
}

export interface ProposalResult {
    status: 'accepted' | 'rejected'
    /** The accepted text, including any edits made in the preview. */
    text?: string
}

export const openProposal = StateEffect.define<Proposal>()
export const closeProposal = StateEffect.define<number>()
/** Clear `stale` (e.g. before a retry, which re-reads the current target text). */
export const refreshProposal = StateEffect.define<number>()

function mapProposal(p: Proposal, changes: ChangeDesc): Proposal {
    let stale = p.stale
    changes.iterChangedRanges((fromA, toA) => {
        if (fromA < p.to && toA > p.from) stale = true
    })
    const from = changes.mapPos(p.from, 1), to = Math.max(from, changes.mapPos(p.to, -1))
    return { ...p, from, to, stale }
}

/**
 * Pending proposals; the first is the one shown. A new user action replaces any other user
 * proposal and goes first; tool proposals queue behind it in arrival order.
 */
export const aiField = StateField.define<Proposal[]>({
    create: () => [],
    update(queue, tr) {
        if (tr.docChanged) queue = queue.map(p => mapProposal(p, tr.changes))
        for (const e of tr.effects) {
            if (e.is(openProposal)) {
                queue = e.value.source === 'action'
                    ? [e.value, ...queue.filter(p => p.source === 'tool')]
                    : [...queue, e.value]
            }
            else if (e.is(closeProposal)) queue = queue.filter(p => p.id !== e.value)
            else if (e.is(refreshProposal)) queue = queue.map(p => (p.id === e.value ? { ...p, stale: false } : p))
        }
        return queue
    },
    provide: f => EditorView.decorations.from(f, (queue): DecorationSet => {
        const p = queue[0]
        return p && p.to > p.from ? Decoration.set(targetMark.range(p.from, p.to)) : Decoration.none
    }),
})

const targetMark = Decoration.mark({ class: 'cm-ai-target' })

let nextId = 1
/** Settles tool proposals' promises; action proposals have no entry. */
const waiting = new Map<number, (result: ProposalResult) => void>()

function settle(id: number, result: ProposalResult) {
    waiting.get(id)?.(result)
    waiting.delete(id)
}

/**
 * Open the AI panel on the main selection (or cursor). With a `preset` it runs right away;
 * without, it asks for an instruction. Returns false when the AI assistant isn't configured or
 * the editor is read-only.
 */
export function openAi(view: EditorView, preset?: AiPreset): boolean {
    if (!view.state.field(aiField, false) || !view.state.facet(EditorView.editable)) return false
    const { from, to } = view.state.selection.main
    view.dispatch({ effects: openProposal.of({
        id: nextId++, from, to, source: 'action', stale: false,
        mode: preset?.mode ?? (from === to ? 'insert' : 'replace'),
        instruction: preset?.instruction ?? '',
        preset: preset?.id,
    }) })
    return true
}

/** Queue a proposal with known `text` (from a tool call) and wait for the user's decision. */
export function propose(view: EditorView, target: { from: number, to: number, mode: ProposalMode, text: string }): Promise<ProposalResult> {
    const id = nextId++
    const { promise, resolve } = Promise.withResolvers<ProposalResult>()
    waiting.set(id, resolve)
    view.dispatch({ effects: openProposal.of({ ...target, id, source: 'tool', instruction: '', stale: false }) })
    return promise
}

/** Write `text` for proposal `id`: one transaction (one undo step), tagged `input.ai`. */
export function acceptProposal(view: EditorView, id: number, text: string): boolean {
    const p = view.state.field(aiField, false)?.find(q => q.id === id)
    if (!p || p.stale) return false
    const spec: TransactionSpec = p.mode === 'block' || p.mode === 'reference'
        ? blockInsertion(view.state, p.from, text)
        : { changes: { from: p.from, to: p.to, insert: text }, selection: { anchor: p.from + text.length } }
    view.dispatch({ ...spec, effects: closeProposal.of(id), userEvent: 'input.ai', scrollIntoView: true })
    settle(id, { status: 'accepted', text })
    return true
}

/** Drop proposal `id` without touching the document. */
export function discardProposal(view: EditorView, id: number) {
    if (view.state.field(aiField, false)?.some(p => p.id === id)) view.dispatch({ effects: closeProposal.of(id) })
    settle(id, { status: 'rejected' })
}

/** Reject every queued proposal, e.g. when the panel goes away, so no tool call waits forever. */
export function rejectAll(ids: readonly number[]) {
    for (const id of ids) settle(id, { status: 'rejected' })
}

/**
 * Each editor's panel accept (the panel holds the draft, which the user may have edited), so Mod-Enter accepts from the
 * editor too, not only with focus in the panel. Set by `AiPanel` while mounted.
 */
const panelAccept = new WeakMap<EditorView, () => boolean>()

export function setPanelAccept(view: EditorView, accept: (() => boolean) | null) {
    if (accept) panelAccept.set(view, accept)
    else panelAccept.delete(view)
}

/** In the editor: Escape discards the shown proposal, Mod-Enter accepts it (before the default keymap's blank line). */
export const aiKeymap = Prec.high(keymap.of([{
    key: 'Escape',
    run: (view) => {
        const p = view.state.field(aiField, false)?.[0]
        if (!p) return false
        discardProposal(view, p.id)
        return true
    },
}, {
    key: 'Mod-Enter',
    run: view => panelAccept.get(view)?.() ?? false,
}]))
