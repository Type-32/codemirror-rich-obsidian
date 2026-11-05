<script setup lang="ts">
import { ref } from 'vue'
import type { EditorContext } from '../overlay'
import { setLink } from '../commands'
import { label } from '../labels'
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
            :placeholder="label(editor.state.value, 'ui.linkPlaceholder', 'Paste a link…')"
            @keydown.esc.prevent="close"
        />
        <UButton
            type="submit"
            size="sm"
            color="neutral"
            variant="ghost"
            :icon="existing && !url ? 'i-lucide-unlink' : 'i-lucide-corner-down-left'"
            :aria-label="existing && !url ? label(editor.state.value, 'ui.linkRemove', 'Remove link') : label(editor.state.value, 'ui.linkApply', 'Apply link')"
        />
    </form>
</template>
