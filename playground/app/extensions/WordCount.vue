<script setup lang="ts">
import type { EditorContext } from '@type32/codemirror-rich-obsidian-editor/kit'

const props = defineProps<{ editor: EditorContext }>()
// The module's own counter, so the playground loads its CommonJS dependency (alfaaz) in the browser.
const { getWordCount } = useDocumentUtils()
const words = computed(() => getWordCount(props.editor.state.value.doc.toString()))
const mountedAt = new Date().toLocaleTimeString()
</script>

<template>
    <div class="absolute -top-7 right-0 text-xs text-muted" data-testid="word-count">
        {{ words }} words · mounted {{ mountedAt }}
    </div>
</template>
