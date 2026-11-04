<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useCompletion } from '@ai-sdk/vue'
import { diffWords } from 'diff'
import { ActionList, filterActions, floatingContent, keepEditorFocus, virtualAnchor, type EditorAction, type EditorContext } from '../../kit'
import { buildPrompt, cleanOutput, cursorPresets, selectionPresets, type AiPreset } from './prompt'
import { AI_ROUTE, acceptProposal, aiField, aiOptions, discardProposal, refreshProposal, rejectAll, type Proposal } from './state'
import { useDirectCompletion } from './direct'

const props = defineProps<{ editor: EditorContext }>()
const { view } = props.editor

// CodeMirror owns which proposals exist and where; this renders the first and runs its request.
const queue = computed(() => props.editor.state.value.field(aiField, false) ?? [])
const active = computed(() => queue.value[0] ?? null)
const options = computed(() => props.editor.state.value.facet(aiOptions))

// Two transports with one shape: `api` through `useCompletion` (it fixes `api` at creation, so the
// URL is resolved per request to let the option change live), or `endpoint` straight from the browser.
const remote = useCompletion({
    fetch: (_url, init) => fetch(options.value.api ?? AI_ROUTE, init),
})
const direct = useDirectCompletion()
/** Transport of the latest request. */
const viaDirect = ref(false)
const completion = computed(() => (viaDirect.value ? direct.completion.value : remote.completion.value))
const isLoading = computed(() => !!(viaDirect.value ? direct.isLoading.value : remote.isLoading.value))
const error = computed(() => (viaDirect.value ? direct.error.value : remote.error.value))
function stop() {
    remote.stop()
    direct.stop()
}

const instruction = ref('')
/** The result as it will be inserted; editable before accepting. */
const draft = ref('')
const editing = ref(false)
/** `prompt`: waiting for an instruction. `result`: streaming or showing a result. */
const phase = ref<'prompt' | 'result'>('prompt')
const selected = ref(-1)
/** The instruction of the last request; names the panel when it was a preset. */
const lastRun = ref('')
const input = ref<{ inputRef?: HTMLInputElement }>()

const isTool = computed(() => active.value?.source === 'tool')
const presets = computed<AiPreset[]>(() => {
    const p = active.value
    const sets = options.value.presets
    return p && p.to > p.from ? sets?.selection ?? selectionPresets : sets?.cursor ?? cursorPresets
})
const presetActions = computed<EditorAction[]>(() => filterActions(
    presets.value.map(({ id, label, icon, keywords }) => ({ id, label, icon, keywords })),
    instruction.value,
))
const ranPreset = computed(() => presets.value.find(x => x.instruction === lastRun.value))
const title = computed(() => {
    const p = active.value
    if (!p) return ''
    if (p.source === 'tool') return p.mode === 'replace' ? 'Suggested edit' : 'Suggested insertion'
    return ranPreset.value?.label ?? 'Ask AI'
})
const original = computed(() => (active.value ? props.editor.state.value.sliceDoc(active.value.from, active.value.to) : ''))
const diff = computed(() => (active.value?.mode === 'replace' && !isLoading.value && !editing.value
    ? diffWords(original.value, draft.value)
    : null))
const shown = computed(() => (isLoading.value ? completion.value : draft.value))
const canAccept = computed(() => !!active.value && !active.value.stale && !isLoading.value && !!draft.value.trim())

const anchor = () => virtualAnchor(view, () => view.state.field(aiField, false)?.[0] ?? { from: 0, to: 0 })
const reference = shallowRef(anchor())

function focusInput() {
    nextTick(() => input.value?.inputRef?.focus())
}

watch(() => active.value?.id, (id, old) => {
    if (old !== undefined && isLoading.value) stop()
    editing.value = false
    selected.value = -1
    lastRun.value = ''
    remote.error.value = undefined
    direct.error.value = undefined
    const p = active.value
    if (id === undefined || !p) return
    reference.value = anchor()
    instruction.value = p.instruction
    if (p.source === 'tool') {
        draft.value = p.text ?? ''
        phase.value = 'result'
        return
    }
    draft.value = ''
    phase.value = 'prompt'
    if (p.instruction) run(p.instruction)
    focusInput()
})

async function run(text: string) {
    const p = active.value
    if (!p || !text.trim()) return
    if (p.stale) view.dispatch({ effects: refreshProposal.of(p.id) })
    instruction.value = text
    lastRun.value = text
    phase.value = 'result'
    editing.value = false
    draft.value = ''
    focusInput()
    const { endpoint, headers, body } = options.value
    const prompt = buildPrompt(view.state, p, text)
    viaDirect.value = !!endpoint
    const result = endpoint
        ? await direct.complete(endpoint, prompt)
        : await remote.complete(prompt, { headers, body: { ...body, preset: ranPreset.value?.id, mode: p.mode } })
    const now = view.state.field(aiField, false)?.find(q => q.id === p.id)
    if (!now || result == null) return
    draft.value = cleanOutput(result, now.mode, view.state.sliceDoc(now.from - 1, now.from))
}

function runPreset(action: EditorAction) {
    const preset = presets.value.find(p => p.id === action.id)
    if (preset) run(preset.instruction)
}

/** Back to writing after a user-invoked proposal; tool proposals leave focus where it is (the host chat). */
function close(p: Proposal) {
    if (p.source === 'action') view.focus()
}

function accept() {
    const p = active.value
    if (!p || !canAccept.value) return
    acceptProposal(view, p.id, draft.value)
    close(p)
}

function discard() {
    const p = active.value
    if (!p) return
    if (isLoading.value) stop()
    discardProposal(view, p.id)
    close(p)
}

function copy() {
    navigator.clipboard?.writeText(draft.value)
}

function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
        e.preventDefault()
        discard()
    }
    else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        accept()
    }
}

function onInputKeydown(e: KeyboardEvent) {
    const n = presetActions.value.length
    if (phase.value === 'prompt' && n && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault()
        const step = e.key === 'ArrowDown' ? 1 : -1
        selected.value = selected.value < 0 ? (step > 0 ? 0 : n - 1) : (selected.value + step + n) % n
    }
    else if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.isComposing) {
        e.preventDefault()
        const action = phase.value === 'prompt' ? presetActions.value[selected.value] : undefined
        if (action) runPreset(action)
        else run(instruction.value)
    }
}

watch(instruction, () => {
    selected.value = -1
})

// Pending tool calls must not wait forever once this editor (or the extension) goes away.
let known: number[] = []
watch(queue, (q) => {
    known = q.map(p => p.id)
})
onBeforeUnmount(() => {
    stop()
    rejectAll(known)
})

const contentProps = floatingContent('bottom', 'start')
</script>

<template>
    <UPopover :open="!!active" :reference="reference" :dismissible="false" :content="contentProps">
        <template #content>
            <div v-if="active" class="cm-ai-panel" @keydown="onKeydown" @mousedown="keepEditorFocus">
                <div class="cm-ai-panel-header">
                    <UIcon name="i-lucide-sparkles" class="cm-ai-panel-icon" />
                    <span class="cm-ai-panel-title">{{ title }}</span>
                    <span v-if="queue.length > 1" class="cm-ai-panel-count">1 of {{ queue.length }}</span>
                </div>

                <div v-if="phase === 'result'" class="cm-ai-output">
                    <UTextarea v-if="editing" v-model="draft" autoresize :rows="3" :maxrows="14" class="cm-ai-editor" />
                    <div v-else-if="diff" class="cm-ai-text cm-ai-diff">
                        <template v-for="(part, i) in diff" :key="i">
                            <del v-if="part.removed">{{ part.value }}</del>
                            <ins v-else-if="part.added">{{ part.value }}</ins>
                            <span v-else>{{ part.value }}</span>
                        </template>
                    </div>
                    <div v-else class="cm-ai-text">{{ shown || (isLoading ? 'Thinking…' : '') }}</div>
                </div>

                <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :description="error.message" />
                <UAlert
                    v-else-if="active.stale"
                    color="warning"
                    variant="subtle"
                    icon="i-lucide-triangle-alert"
                    :description="isTool ? 'The text changed since this was suggested.' : 'The text changed since this was generated. Retry to use the current text.'"
                />

                <UInput
                    v-if="!isTool"
                    ref="input"
                    v-model="instruction"
                    :placeholder="phase === 'prompt' ? 'Ask AI to…' : 'Refine, e.g. “more formal”'"
                    :loading="isLoading"
                    icon="i-lucide-message-square-text"
                    size="sm"
                    class="cm-ai-input"
                    @keydown="onInputKeydown"
                />

                <ActionList
                    v-if="phase === 'prompt' && presetActions.length"
                    :groups="[presetActions]"
                    :state="editor.state.value"
                    :selected="selected"
                    @run="runPreset"
                    @hover="(i: number) => selected = i"
                />

                <div v-if="phase === 'result'" class="cm-ai-actions">
                    <UButton v-if="isLoading" label="Stop" icon="i-lucide-square" color="neutral" variant="subtle" size="sm" @click="stop()" />
                    <template v-else-if="active.mode === 'reference'">
                        <UButton label="Insert below" icon="i-lucide-corner-down-left" size="sm" :disabled="!canAccept" @click="accept" />
                        <UButton label="Copy" icon="i-lucide-copy" color="neutral" variant="subtle" size="sm" :disabled="!draft" @click="copy" />
                    </template>
                    <template v-else>
                        <UButton label="Accept" icon="i-lucide-check" size="sm" :disabled="!canAccept" @click="accept">
                            <template #trailing>
                                <UKbd value="meta" size="sm" /><UKbd value="enter" size="sm" />
                            </template>
                        </UButton>
                        <UButton
                            :label="editing ? 'Done' : 'Edit'"
                            icon="i-lucide-pencil"
                            color="neutral"
                            variant="subtle"
                            size="sm"
                            :disabled="!draft"
                            @click="editing = !editing"
                        />
                    </template>
                    <UButton v-if="!isTool && !isLoading" label="Retry" icon="i-lucide-rotate-ccw" color="neutral" variant="ghost" size="sm" @click="run(instruction)" />
                    <UButton label="Discard" color="neutral" variant="ghost" size="sm" class="cm-ai-discard" @click="discard">
                        <template #trailing>
                            <UKbd value="escape" size="sm" />
                        </template>
                    </UButton>
                </div>
            </div>
        </template>
    </UPopover>
</template>
