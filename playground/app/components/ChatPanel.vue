<script setup lang="ts">
import { Chat } from '@ai-sdk/vue'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from 'ai'
import type { EditorView } from '@codemirror/view'
import { isEditorTool, runEditorTool } from '@type32/codemirror-rich-obsidian-editor/ext/ai'

// The host's chat, outside the editor. Tool calls run against the editor and wait for the user's
// Accept / Discard in its preview; the result goes back to the model.
const props = defineProps<{ view?: EditorView }>()
const input = ref('')

const chat = new Chat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall({ toolCall }) {
        if (!props.view || !isEditorTool(toolCall)) return
        // Not awaited: `onToolCall` must return before the user decides.
        runEditorTool(props.view, toolCall).then(output =>
            chat.addToolOutput({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, output }))
    },
})

function submit() {
    if (!input.value.trim()) return
    chat.sendMessage({ text: input.value })
    input.value = ''
}
</script>

<template>
    <div class="flex flex-col gap-2 w-96 h-[32rem] border border-default rounded-lg p-2">
        <UChatMessages :messages="chat.messages" :status="chat.status" class="flex-1 overflow-y-auto">
            <template #content="{ message }">
                <template v-for="(part, i) in message.parts" :key="i">
                    <p v-if="part.type === 'text'" class="whitespace-pre-wrap text-sm">{{ part.text }}</p>
                    <UChatTool
                        v-else-if="part.type.startsWith('tool-')"
                        :text="`${part.type.slice(5)}${'state' in part ? ` · ${part.state}` : ''}`"
                        icon="i-lucide-wrench"
                    />
                </template>
            </template>
        </UChatMessages>
        <UChatPrompt v-model="input" :error="chat.error" placeholder="Ask about the document…" @submit="submit">
            <UChatPromptSubmit :status="chat.status" @stop="chat.stop()" @reload="chat.regenerate()" />
        </UChatPrompt>
    </div>
</template>
