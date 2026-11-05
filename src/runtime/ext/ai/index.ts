// `@type32/codemirror-rich-obsidian-editor/ext/ai`. Needs the optional peers `ai`, `@ai-sdk/vue` and
// `@ai-sdk/openai-compatible`; without them the module aliases this path to `unavailable.ts`.
import type { Extension } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { vueOverlay, type EditorAction } from '../../kit'
import { slashItems, toolbarItems } from '..'
import { aiField, aiKeymap, aiOptions, openAi, type AiAssistantOptions } from './state'
import { cursorPresets, type AiPreset } from './prompt'
import AiPanel from './AiPanel.vue'

export * from './api'

const overlay = vueOverlay(AiPanel)

// Ids double as `editorLabels` keys: `askAi`, and each preset's own id.
const askAi: EditorAction = {
    id: 'askAi', label: 'Ask AI', icon: 'i-lucide-sparkles', keywords: ['assistant', 'prompt'],
    run: (view) => { openAi(view) },
}

const presetAction = (preset: AiPreset): EditorAction => ({
    id: preset.id, label: preset.label, icon: preset.icon, keywords: ['ai', ...(preset.keywords ?? [])],
    run: (view) => { openAi(view, preset) },
})

/**
 * AI that only proposes: every result opens in a floating preview over its target, and only
 * Accept writes it (one undo step, `userEvent: 'input.ai'`). Opened from the selection toolbar's
 * "Ask AI", the slash menu's AI group, or `shortcut`; nothing appears unless invoked.
 */
export function aiAssistant(options: AiAssistantOptions = {}): Extension {
    const { toolbar = true, slash = true, shortcut = 'Mod-j' } = options
    return [
        aiOptions.of(options),
        aiField,
        aiKeymap,
        overlay,
        shortcut ? keymap.of([{ key: shortcut, run: view => openAi(view) }]) : [],
        toolbar ? toolbarItems.of([[askAi]]) : [],
        slash ? slashItems.of([[askAi, ...(options.presets?.cursor ?? cursorPresets).map(presetAction)]]) : [],
    ]
}
