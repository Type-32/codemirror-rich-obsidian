import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'
import { createError } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'

interface AiConfig {
    baseURL?: string
    model?: string
    apiKey?: string
    headers?: Record<string, string>
}

/**
 * The model at the OpenAI-compatible endpoint configured in `cmOfmEditor.ai` (nuxt.config, or
 * `NUXT_CM_OFM_EDITOR_AI_BASE_URL` / `_MODEL` / `_API_KEY`). Used by the module's AI route; call it
 * in your own routes too, e.g. a chat with `editorTools`. Auto-imported on the server.
 */
export function useEditorAiModel(): LanguageModel {
    const ai: AiConfig | undefined = useRuntimeConfig().cmOfmEditor?.ai
    const { baseURL, model, apiKey, headers } = ai ?? {}
    if (!baseURL || !model) {
        throw createError({ statusCode: 503, statusMessage: 'No AI endpoint: set cmOfmEditor.ai.baseURL and .model in nuxt.config (or NUXT_CM_OFM_EDITOR_AI_BASE_URL / _MODEL).' })
    }
    return createOpenAICompatible({ name: 'cm-ofm-editor', baseURL, apiKey: apiKey || undefined, headers }).chatModel(model)
}
