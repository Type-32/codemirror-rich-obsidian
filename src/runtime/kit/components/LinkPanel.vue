<script setup lang="ts">
import { ref } from 'vue'
import type { EditorContext } from '../overlay'
import { setLink } from '../commands'
import { linkAt } from '../queries'

const props = defineProps<{ editor: EditorContext, close: () => void }>()
const { view } = props.editor
const { from, to } = view.state.selection.main
const existing = linkAt(view.state, from, to)
const url = ref(existing?.url ?? '')

function commit() {
    setLink(url.value)(view)
    props.close()
}
</script>

<template>
    <form class="cm-link-panel" @submit.prevent="commit">
        <UInput
            v-model="url"
            autofocus
            size="sm"
            variant="none"
            placeholder="Paste a link…"
            @keydown.esc.prevent="close"
        />
        <UButton
            type="submit"
            size="sm"
            color="neutral"
            variant="ghost"
            :icon="existing && !url ? 'i-lucide-unlink' : 'i-lucide-corner-down-left'"
            :aria-label="existing && !url ? 'Remove link' : 'Apply link'"
        />
    </form>
</template>
