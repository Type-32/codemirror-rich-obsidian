// Stand-in for `/ext/ai` when `ai` or `@ai-sdk/vue` isn't installed: same exports, but
// `aiAssistant()` warns once and adds nothing, so the editor keeps working without AI.
import type { Extension } from '@codemirror/state'
import type { AiAssistantOptions } from './state'

export * from './api'

let warned = false

export function aiAssistant(_options: AiAssistantOptions = {}): Extension {
    if (!warned) {
        warned = true
        console.warn('[codemirror-rich-obsidian-editor] aiAssistant() is disabled: install the optional peer dependencies `ai` and `@ai-sdk/vue` to enable it.')
    }
    return []
}
