<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { ActionList, floatingContent, virtualAnchor, type EditorAction, type EditorContext } from '../../kit'
import { closeSlash, runSlashAction, selectSlash, slashField, slashMatches } from './state'

const props = defineProps<{ editor: EditorContext }>()
const { view } = props.editor

// A pure view of `slashField`: CodeMirror owns open/query/selection; this only renders and forwards clicks.
const slash = computed(() => props.editor.state.value.field(slashField, false) ?? null)
const groups = computed(() => (slash.value ? slashMatches(props.editor.state.value, slash.value.query) : []))
const open = computed(() => groups.value.length > 0)

const anchor = () => virtualAnchor(view, () => {
    const from = view.state.field(slashField, false)?.from ?? 0
    return { from, to: from + 1 }
})
const reference = shallowRef(anchor())
// New reference object on each (re)open or shift of the `/`, so floating-ui re-measures.
watch(() => slash.value?.from, (from) => {
    if (from !== undefined) reference.value = anchor()
})

watch(props.editor.focused, (focused) => {
    if (!focused && slash.value) view.dispatch({ effects: closeSlash.of(null) })
})

function run(action: EditorAction) {
    runSlashAction(view, action)
    view.focus()
}

function hover(index: number) {
    view.dispatch({ effects: selectSlash.of(index) })
}

const contentProps = floatingContent('bottom', 'start')
</script>

<template>
    <UPopover :open="open" :reference="reference" :dismissible="false" :content="contentProps">
        <template #content>
            <ActionList
                class="cm-slash-menu"
                :groups="groups"
                :state="editor.state.value"
                :selected="slash?.selected ?? -1"
                @run="run"
                @hover="hover"
            />
        </template>
    </UPopover>
</template>
