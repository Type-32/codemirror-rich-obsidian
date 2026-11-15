<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { floatingContent, virtualAnchor, type EditorContext } from '../../kit/overlay'
import { closeLinkSuggest, linkQueryField, linkSuggestionsIn, pickLinkSuggestion, selectLinkSuggestion } from '../../editor/plugins/codemirror-editor-plugins/linkSuggestPlugin'
import { LINK_ICONS, type LinkSuggestion } from '../../editor/utility/linkSearch'

const props = defineProps<{ editor: EditorContext }>()
const { view } = props.editor

// A pure view of `linkQueryField`: CodeMirror owns open/query/selection; this renders and forwards the mouse.
const query = computed(() => props.editor.state.value.field(linkQueryField, false) ?? null)
const items = computed(() => (query.value ? linkSuggestionsIn(props.editor.state.value) : []))
// Only in the editor being typed in: typing in a table cell is mirrored into the note, which would open the note's too.
const open = computed(() => items.value.length > 0 && props.editor.focused.value)
const selected = computed(() => query.value?.selected ?? 0)

const anchor = () => virtualAnchor(view, () => {
    const from = view.state.field(linkQueryField, false)?.from ?? 0
    return { from, to: from }
})
const reference = shallowRef(anchor())
// New reference object on each (re)open, so floating-ui re-measures.
watch(() => query.value?.from, (from) => {
    if (from !== undefined) reference.value = anchor()
})

watch(props.editor.focused, (focused) => {
    if (!focused && query.value) view.dispatch({ effects: closeLinkSuggest.of(null) })
})

// ── Windowed list: rows have one height, so only the rows in view (and a few either side) are in the DOM. ──
const ROW = 44
const OVERSCAN = 4
const scroller = ref<HTMLElement>()
const scrollTop = ref(0)
const viewport = ref(240)
const rows = computed(() => {
    const first = Math.max(0, Math.floor(scrollTop.value / ROW) - OVERSCAN)
    const last = Math.min(items.value.length, Math.ceil((scrollTop.value + viewport.value) / ROW) + OVERSCAN)
    return Array.from({ length: Math.max(0, last - first) }, (_, i) => first + i)
})

function onScroll() {
    scrollTop.value = scroller.value!.scrollTop
    viewport.value = scroller.value!.clientHeight
}

// Keep the selection in view as the keyboard moves it (a new query selects the first row, scrolling to the top).
watch([selected, () => query.value?.query], async () => {
    await nextTick()
    const el = scroller.value
    if (!el) return
    const top = selected.value * ROW
    if (top < el.scrollTop) el.scrollTop = top
    else if (top + ROW > el.scrollTop + el.clientHeight) el.scrollTop = top + ROW - el.clientHeight
    onScroll()
})

function hover(index: number) {
    if (index !== selected.value) view.dispatch({ effects: selectLinkSuggestion.of(index) })
}

function pick(item: LinkSuggestion) {
    pickLinkSuggestion(view, item)
    view.focus()
}

const contentProps = floatingContent('bottom', 'start')
</script>

<template>
    <UPopover :open="open" :reference="reference" :dismissible="false" :content="contentProps" :ui="{ content: 'cm-menu' }">
        <template #content>
            <div ref="scroller" class="cm-link-suggest" role="listbox" @scroll="onScroll" @mousedown.prevent>
                <div class="cm-link-suggest-space" :style="{ height: `${items.length * ROW}px` }">
                    <div
                        v-for="i in rows" :key="i"
                        class="cm-link-suggest-item"
                        role="option"
                        :aria-selected="i === selected"
                        :data-kind="items[i]!.kind"
                        :style="{ top: `${i * ROW}px`, height: `${ROW}px` }"
                        @mousemove="hover(i)"
                        @click="pick(items[i]!)"
                    >
                        <UIcon :name="LINK_ICONS[items[i]!.kind]" class="cm-link-suggest-icon" />
                        <span class="cm-link-suggest-text">
                            <span class="cm-link-suggest-label">{{ items[i]!.label }}</span>
                            <span v-if="items[i]!.detail" class="cm-link-suggest-detail">{{ items[i]!.detail }}</span>
                        </span>
                    </div>
                </div>
            </div>
        </template>
    </UPopover>
</template>
