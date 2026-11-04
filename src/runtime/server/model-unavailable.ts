import { createError } from 'h3'

// Stand-in for `useEditorAiModel` when `ai` or `@ai-sdk/openai-compatible` isn't installed.
export function useEditorAiModel(): never {
    throw createError({ statusCode: 503, statusMessage: 'useEditorAiModel() needs the optional peer dependencies `ai` and `@ai-sdk/openai-compatible`.' })
}
