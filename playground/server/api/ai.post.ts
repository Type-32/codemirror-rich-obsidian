import { streamText } from 'ai'

// Endpoint for `aiAssistant()`: the editor sends the full prompt; `preset` and `mode` are there if
// the host wants to route or log by action.
export default defineEventHandler(async (event) => {
    const { prompt } = await readBody<{ prompt: string, preset?: string, mode: string }>(event)
    return streamText({ model: await resolveModel(), prompt }).toUIMessageStreamResponse()
})
