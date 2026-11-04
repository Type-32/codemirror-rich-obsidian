<script setup lang="ts">
import type { EditorContext } from '@type32/codemirror-rich-obsidian-editor/kit'

const props = defineProps<{ editor: EditorContext }>()
const words = computed(() => props.editor.state.value.doc.toString().split(/\s+/).filter(Boolean).length)
const mountedAt = new Date().toLocaleTimeString()
</script>

<template>
    <div class="absolute -top-7 right-0 text-xs text-muted" data-testid="word-count">
        {{ words }} words · mounted {{ mountedAt }}
    </div>
</template>
