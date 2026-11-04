import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'

/** A local Ollama, if one answers: `OLLAMA_MODEL` or its first installed model. */
async function ollama(): Promise<LanguageModel | null> {
    const base = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
    const tags = await $fetch<{ models: { name: string }[] }>(`${base}/api/tags`, { timeout: 1000 }).catch(() => null)
    const name = process.env.OLLAMA_MODEL ?? tags?.models[0]?.name
    return name ? createOpenAICompatible({ name: 'ollama', baseURL: `${base}/v1` }).chatModel(name) : null
}

/**
 * The first available provider: Ollama, then OpenRouter, Vercel AI Gateway, and any
 * OpenAI-compatible endpoint (OpenAI, LM Studio, vLLM, …). Checked per request so starting Ollama
 * or setting a key takes effect without a restart.
 */
export async function resolveModel(): Promise<LanguageModel> {
    const env = process.env
    const local = await ollama()
    if (local) return local
    if (env.OPENROUTER_API_KEY) {
        return createOpenAICompatible({ name: 'openrouter', baseURL: 'https://openrouter.ai/api/v1', apiKey: env.OPENROUTER_API_KEY })
            .chatModel(env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini')
    }
    if (env.AI_GATEWAY_API_KEY) return env.AI_GATEWAY_MODEL ?? 'openai/gpt-4o-mini'
    if (env.OPENAI_COMPATIBLE_BASE_URL) {
        return createOpenAICompatible({ name: 'openai-compatible', baseURL: env.OPENAI_COMPATIBLE_BASE_URL, apiKey: env.OPENAI_COMPATIBLE_API_KEY })
            .chatModel(env.OPENAI_COMPATIBLE_MODEL ?? 'gpt-4o-mini')
    }
    throw createError({
        statusCode: 503,
        statusMessage: 'No AI provider. Run Ollama, or set OPENROUTER_API_KEY, AI_GATEWAY_API_KEY, or OPENAI_COMPATIBLE_BASE_URL.',
    })
}
