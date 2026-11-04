import { streamText } from 'ai'
import { createError, defineEventHandler, readBody } from 'h3'
import { useEditorAiModel } from './model'

/** Upper bound on a prompt; the editor sends ~2–3k characters plus the target text. */
const MAX_PROMPT_CHARS = 100_000

// `POST /api/_cm-editor/ai`: the default `api` of `aiAssistant()`. Public like any route; guard it
// with your auth middleware, or disable it (`cmOfmEditor.ai.route: false`) and serve your own.
export default defineEventHandler(async (event) => {
    const body = await readBody<{ prompt?: unknown } | null>(event)
    const prompt = body?.prompt
    if (typeof prompt !== 'string' || !prompt.trim()) throw createError({ statusCode: 400, statusMessage: '`prompt` must be a non-empty string.' })
    if (prompt.length > MAX_PROMPT_CHARS) throw createError({ statusCode: 413, statusMessage: 'Prompt too long.' })
    return streamText({ model: useEditorAiModel(), prompt }).toUIMessageStreamResponse()
})
