<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { EditorState } from '@codemirror/state'
import type { EditorAction } from '../actions'
import { keepEditorFocus } from '../overlay'

/** Vertical menu of grouped actions with an optional keyboard-driven `selected` index (flat, across groups). */
const props = withDefaults(defineProps<{ groups: EditorAction[][], state: EditorState, selected?: number }>(), { selected: -1 })
const emit = defineEmits<{ run: [action: EditorAction], hover: [index: number] }>()

const root = ref<HTMLElement>()
const rows = computed(() => {
    let index = 0
    return props.groups.map(group => group.map(action => ({ action, index: index++ })))
})
const disabled = (a: EditorAction) => !!a.isEnabled && !a.isEnabled(props.state)

watch(() => props.selected, async (i) => {
    await nextTick()
    root.value?.querySelector(`[data-index="${i}"]`)?.scrollIntoView({ block: 'nearest' })
})
</script>

<template>
    <div ref="root" class="cm-action-list" role="listbox" @mousedown="keepEditorFocus">
        <template v-for="(group, g) in rows" :key="g">
            <div v-if="g" class="cm-action-list-separator" role="separator" />
            <button
                v-for="{ action, index } in group"
                :key="action.id"
                type="button"
                role="option"
                class="cm-action-list-item"
                :data-index="index"
                :data-color="action.color"
                :aria-selected="index === selected"
                :disabled="disabled(action)"
                @click="emit('run', action)"
                @mousemove="index !== selected && emit('hover', index)"
            >
                <UIcon v-if="action.icon" :name="action.icon" class="cm-action-list-icon" />
                <span class="cm-action-list-label">{{ action.label }}</span>
                <span v-if="action.kbds" class="cm-action-list-kbds">
                    <UKbd v-for="k in action.kbds" :key="k" :value="k" size="sm" />
                </span>
            </button>
        </template>
    </div>
</template>
