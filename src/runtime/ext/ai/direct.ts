import { ref } from 'vue'
import { streamText } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { AiEndpoint } from './state'

/**
 * `useCompletion`'s shape (`completion`, `isLoading`, `error`, `complete`, `stop`) for an
 * OpenAI-compatible endpoint called from the browser with ai-sdk's `streamText`. `complete`
 * resolves the full text, `null` when stopped, `undefined` on error (as `useCompletion` does).
 */
export function useDirectCompletion() {
    const completion = ref('')
    const isLoading = ref(false)
    const error = ref<Error | undefined>()
    let controller: AbortController | null = null

    async function complete(endpoint: AiEndpoint, prompt: string): Promise<string | null | undefined> {
        controller?.abort()
        const own = controller = new AbortController()
        completion.value = ''
        error.value = undefined
        isLoading.value = true
        try {
            const { baseURL, model, apiKey, headers, fetch, system } = endpoint
            const result = streamText({
                model: createOpenAICompatible({ name: 'cm-ofm-editor', baseURL, apiKey, headers, fetch }).chatModel(model),
                instructions: system,
                prompt,
                abortSignal: own.signal,
            })
            let text = ''
            for await (const part of result.stream) {
                if (part.type === 'error') throw part.error
                if (part.type !== 'text-delta') continue
                text += part.text
                if (own === controller) completion.value = text
            }
            return text
        }
        catch (err) {
            if (own.signal.aborted) return null
            if (own === controller) error.value = err instanceof Error ? err : new Error(String(err))
            return undefined
        }
        finally {
            if (own === controller) {
                controller = null
                isLoading.value = false
            }
        }
    }

    return { completion, isLoading, error, complete, stop: () => controller?.abort() }
}
