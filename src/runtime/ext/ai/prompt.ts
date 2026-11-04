import type { EditorState } from '@codemirror/state'
import { headingAt, headings } from '../../kit'

/**
 * Where an accepted result goes. `replace`: over the target text. `insert`: at the cursor, inline.
 * `block`: as its own block at the cursor line. `reference`: shown only (Copy / Insert below), never
 * proposed as an edit.
 */
export type ProposalMode = 'replace' | 'insert' | 'block' | 'reference'

/** A named AI action: an instruction sent with the target text and its context. */
export interface AiPreset {
    id: string
    label: string
    icon?: string
    keywords?: string[]
    instruction: string
    /** Default: `replace` with a selection, `insert` without. */
    mode?: ProposalMode
}

/** Offered when the AI panel opens on a selection. */
export const selectionPresets: AiPreset[] = [
    { id: 'improve', label: 'Improve writing', icon: 'i-lucide-wand-sparkles', keywords: ['better', 'polish'], instruction: 'Improve the writing: clearer and more fluent, same meaning, tone and length.' },
    { id: 'fix', label: 'Fix spelling & grammar', icon: 'i-lucide-spell-check', keywords: ['typo', 'proofread'], instruction: 'Fix spelling, grammar and punctuation. Change nothing else.' },
    { id: 'shorten', label: 'Make shorter', icon: 'i-lucide-fold-vertical', keywords: ['concise', 'shorten'], instruction: 'Make it shorter and more concise without losing meaning.' },
    { id: 'expand', label: 'Make longer', icon: 'i-lucide-unfold-vertical', keywords: ['expand', 'elaborate'], instruction: 'Expand it with more detail, keeping the tone and style.' },
    { id: 'simplify', label: 'Simplify language', icon: 'i-lucide-baby', keywords: ['plain', 'easy'], instruction: 'Rewrite it in simpler, plainer language.' },
]

/** Offered at a cursor (AI panel without selection, slash menu). */
export const cursorPresets: AiPreset[] = [
    { id: 'continue', label: 'Continue writing', icon: 'i-lucide-pen-line', keywords: ['next', 'more'], instruction: 'Continue writing from the cursor, matching the style. One or two sentences or a short paragraph.', mode: 'insert' },
    { id: 'outline', label: 'Outline', icon: 'i-lucide-list-tree', keywords: ['structure', 'plan'], instruction: 'Write an outline for the rest of this section as a nested Markdown list.', mode: 'block' },
    { id: 'brainstorm', label: 'Brainstorm ideas', icon: 'i-lucide-lightbulb', keywords: ['ideas', 'stuck', 'writer\'s block'], instruction: 'Brainstorm 5–8 short, varied ideas for where this text could go next, as a Markdown list. These are suggestions for the writer, not text for the document.', mode: 'reference' },
]

const BEFORE_CHARS = 1500
const AFTER_CHARS = 500

/**
 * Text around [from, to]: up to `BEFORE_CHARS` before and `AFTER_CHARS` after, trimmed to whole
 * blocks (blank-line boundaries) when the window cuts into the document.
 * ponytail: fixed char windows; budget by tokens if long documents need more context.
 */
export function contextAround(state: EditorState, from: number, to: number) {
    const start = Math.max(0, from - BEFORE_CHARS), end = Math.min(state.doc.length, to + AFTER_CHARS)
    let before = state.sliceDoc(start, from), after = state.sliceDoc(to, end)
    if (start > 0) {
        const cut = before.indexOf('\n\n')
        if (cut >= 0) before = before.slice(cut + 2)
    }
    if (end < state.doc.length) {
        const cut = after.lastIndexOf('\n\n')
        if (cut >= 0) after = after.slice(0, cut)
    }
    return { before, after }
}

const block = (label: string, text: string) => `${label}:\n<<<\n${text}\n>>>`

const OUTPUT_RULE: Record<ProposalMode, string> = {
    replace: 'Reply with only the text that replaces the selected text.',
    insert: 'Reply with only the text to insert at the cursor. It must read on seamlessly from the text before.',
    block: 'Reply with only the block to insert at the cursor.',
    reference: 'Reply with only your answer. It is shown to the writer as a note, not inserted into the document.',
}

/** The prompt for `instruction` on [from, to]: outline, surrounding text, target, and output rules. */
export function buildPrompt(state: EditorState, target: { from: number, to: number, mode: ProposalMode }, instruction: string) {
    const { from, to, mode } = target
    const { before, after } = contextAround(state, from, to)
    const current = headingAt(state, from)
    const outline = headings(state)
        .map(h => `${'  '.repeat(h.level - 1)}- ${h.text}${h.from === current?.from ? '  ← current section' : ''}`)
        .join('\n')
    return [
        'You are assisting a writer with a Markdown (Obsidian-flavoured) document.',
        `Task: ${instruction}`,
        outline && block('Document outline', outline),
        block('Text before', before),
        from === to ? '[cursor is here]' : block('Selected text', state.sliceDoc(from, to)),
        block('Text after', after),
        `${OUTPUT_RULE[mode]} Use Markdown. Match the document's language and style. No preamble, explanations, quotes, or code fence around the whole answer.`,
    ].filter(Boolean).join('\n\n')
}

/**
 * Clean model output for insertion: drop one code fence wrapping the whole answer and surrounding
 * blank space; for an inline `insert` after a word, keep a separating space.
 */
export function cleanOutput(text: string, mode: ProposalMode, charBefore = '') {
    let out = text.trim()
    const fenced = /^```[\w-]*\n([\s\S]*)\n```$/.exec(out)
    if (fenced && !/^```/m.test(fenced[1]!)) out = fenced[1]!.trim()
    if (mode === 'insert' && /\S/.test(charBefore) && /^[\p{L}\p{N}]/u.test(out)) out = ` ${out}`
    return out
}
