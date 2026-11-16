<script setup lang="ts">
import CodeMirror from 'vue-codemirror6'
import { keymap, EditorView, drawSelection, rectangularSelection } from '@codemirror/view'
import { standardKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { indentOnInput, foldGutter } from '@codemirror/language'
import { Compartment, type Extension, type StateEffect } from '@codemirror/state'
import wysiwyg from '../editor/wysiwyg'
import { internalLinkMapFacet } from '../editor/plugins/linkMappingConfig'
import { specialCodeBlockMapFacet } from '../editor/plugins/specialCodeBlockMappingConfig'
import { customBracketClosingConfig } from '../editor/plugins/customBracketClosingConfig'
import { contextMenuSize, type MenuSize } from '../editor/plugins/hostAppConfig'
import { vueRenderers } from '../vue/renderers'
import { editorKeywordSearchPlugin, searchOptionsFacet } from '../editor/plugins/codemirror-editor-plugins/editorKeywordSearchPlugin'
import { propertiesPanel } from '../editor/plugins/codemirror-plugin-proses/propertiesPlugin'
import { textChanges } from '../editor/utility/textChanges'
import type {
    InternalLink,
    SpecialCodeBlockMapping,
    InternalLinkClickDetail,
    ExternalLinkClickDetail,
    MarkdownOptions,
    PropertiesOptions,
    SearchOptions
} from '../editor/types/editor-types'
import { ref, shallowRef, onMounted, onBeforeUnmount, watch, getCurrentInstance, type AppContext } from 'vue';

const doc = defineModel<string>()
// Explicit defaults: Vue casts an absent prop whose type includes `boolean`/`false` to `false`.
const props = withDefaults(defineProps<{
    class?: string
    internalLinkMap?: InternalLink[]
    specialCodeBlockMap?: SpecialCodeBlockMapping[]
    bracketClosing?: boolean
    foldGutter?: boolean
    disabled?: boolean
    searchOptions?: SearchOptions
    /** Extra CodeMirror extensions (e.g. from `/ext` or your own). Reactive: changing the array reconfigures live. */
    extensions?: Extension[]
    /** Frontmatter as Obsidian's Properties panel (default), with its options; `false` shows the raw YAML. */
    properties?: PropertiesOptions | false
    /** Nuxt UI size of the menus the editor opens: a property's type menu, a table's context menu. Default `md`. */
    contextMenuSize?: MenuSize
    /**
     * CodeMirror's undo history and its keys (default `true`). `false` when something else owns undo, such as a
     * collaboration binding's undo manager, so each peer undoes only its own edits. Read when the editor mounts.
     */
    history?: boolean
    /**
     * Markdown syntax added to the editor's (Lezer `MarkdownConfig`s) and the fenced-code languages. Callouts and table
     * cells parse the same. Changing it reparses the note; pass the same object between renders.
     */
    markdown?: MarkdownOptions
}>(), { properties: () => ({}), bracketClosing: true, foldGutter: true, history: true })
const emit = defineEmits<{
    'internal-link-click': [detail: InternalLinkClickDetail]
    'external-link-click': [detail: ExternalLinkClickDetail]
}>()
const cmExtensions = shallowRef<Extension[]>([])
const view = shallowRef<EditorView>()
const internalLinkCompartment = new Compartment()
const specialCodeBlockCompartment = new Compartment()
const bracketClosingCompartment = new Compartment()
const foldGutterCompartment = new Compartment()
const searchCompartment = new Compartment()
const extensionsCompartment = new Compartment()
const propertiesCompartment = new Compartment()
const contextMenuSizeCompartment = new Compartment()
const markdownCompartment = new Compartment()
const propertiesExtension = (p: PropertiesOptions | false | undefined) => (p === false ? [] : propertiesPanel(p))
const editorElement = ref<HTMLElement>()
const instance = getCurrentInstance()
// Components CodeMirror mounts render as if they were children of this one: a root vnode's provides
// inherit from `appContext.provides`, so swap in this instance's provides chain (which reaches <UApp>).
// `instance.provides` is Vue-internal (untyped) but stable since 3.0.
const vueContext = instance
    ? { ...instance.appContext, provides: (instance as unknown as { provides: AppContext['provides'] }).provides }
    : null
// Prop changes that land before vue-codemirror6 emits @ready are queued here and flushed in handleReady.
let pendingEffects: StateEffect<unknown>[] = []
// vue-codemirror6 replaces the whole document whenever its value differs from the view's, which moves the cursor
// and, with a collaboration binding, a peer's concurrent edit. It gets only the first value; later ones go in as the
// changes between the two texts (`syncFromModel`).
const initialDoc = doc.value ?? ''

onMounted(() => {
    cmExtensions.value = [
        EditorView.lineWrapping,
        props.history ? history() : [],
        drawSelection(),
        rectangularSelection(),
        indentOnInput(),
        keymap.of(props.disabled ? [] : [...standardKeymap, ...(props.history ? historyKeymap : []), indentWithTab]),
        internalLinkCompartment.of(internalLinkMapFacet.of(props.internalLinkMap || [])),
        specialCodeBlockCompartment.of(specialCodeBlockMapFacet.of(props.specialCodeBlockMap || [])),
        bracketClosingCompartment.of(customBracketClosingConfig.of(props.bracketClosing)),
        foldGutterCompartment.of(props.foldGutter ? foldGutter() : []),
        editorKeywordSearchPlugin,
        vueRenderers(vueContext),
        searchCompartment.of(searchOptionsFacet.of(props.searchOptions || { query: '' })),
        markdownCompartment.of(wysiwyg({ lezer: props.markdown })),
        EditorView.editable.of(!props.disabled),
        extensionsCompartment.of(props.extensions ?? []),
        propertiesCompartment.of(propertiesExtension(props.properties)),
        contextMenuSizeCompartment.of(contextMenuSize.of(props.contextMenuSize)),
    ]
    editorElement.value?.addEventListener('internal-link-click', handleInternalLinkClick as EventListener)
    editorElement.value?.addEventListener('external-link-click', handleExternalLinkClick as EventListener)
})

onBeforeUnmount(() => {
    editorElement.value?.removeEventListener('internal-link-click', handleInternalLinkClick as EventListener)
    editorElement.value?.removeEventListener('external-link-click', handleExternalLinkClick as EventListener)
})

function handleInternalLinkClick(event: CustomEvent<InternalLinkClickDetail>) {
    emit('internal-link-click', event.detail)
}

function handleExternalLinkClick(event: CustomEvent<ExternalLinkClickDetail>) {
    emit('external-link-click', event.detail)
}

function reconfigure(effect: StateEffect<unknown>) {
    if (view.value) view.value.dispatch({ effects: effect })
    else pendingEffects.push(effect)
}

watch(() => props.internalLinkMap, m => reconfigure(internalLinkCompartment.reconfigure(internalLinkMapFacet.of(m || []))), { deep: true })
watch(() => props.specialCodeBlockMap, m => reconfigure(specialCodeBlockCompartment.reconfigure(specialCodeBlockMapFacet.of(m || []))), { deep: true })
watch(() => props.bracketClosing, v => reconfigure(bracketClosingCompartment.reconfigure(customBracketClosingConfig.of(v))))
watch(() => props.foldGutter, v => reconfigure(foldGutterCompartment.reconfigure(v ? foldGutter() : [])))
watch(() => props.searchOptions, o => reconfigure(searchCompartment.reconfigure(searchOptionsFacet.of(o || { query: '' }))), { deep: true })
watch(() => props.extensions, e => reconfigure(extensionsCompartment.reconfigure(e ?? [])))
watch(() => props.properties, p => reconfigure(propertiesCompartment.reconfigure(propertiesExtension(p))))
watch(() => props.contextMenuSize, s => reconfigure(contextMenuSizeCompartment.reconfigure(contextMenuSize.of(s))))
watch(() => props.markdown, m => reconfigure(markdownCompartment.reconfigure(wysiwyg({ lezer: m }))))

/** The host set `v-model` to something the editor doesn't show: write what changed. Not while composing (IME). */
function syncFromModel() {
    const v = view.value, next = doc.value ?? ''
    if (!v || v.composing) return
    const current = v.state.doc.toString()
    if (next !== current) v.dispatch({ changes: textChanges(current, next) })
}
watch(doc, syncFromModel)

function handleReady(payload: { view: EditorView }) {
    view.value = payload.view
    if (pendingEffects.length) {
        payload.view.dispatch({ effects: pendingEffects })
        pendingEffects = []
    }
    syncFromModel()
}

defineExpose({ view })
</script>

<template>
    <div :class="props.class ? props.class : 'w-full h-full overflow-visible'" ref="editorElement">
        <div class="w-full cm-rich-editor overflow-visible">
            <CodeMirror
                :model-value="initialDoc"
                @update:model-value="value => doc = String(value)"
                placeholder="Start typing your markdown content here..."
                :basic="false"
                :autofocus="true"
                :indent-with-tab="true"
                :tab-size="4"
                :tab="true"
                :indent-unit="'\t'"
                :extensions="cmExtensions"
                @ready="handleReady"
                class="w-full h-full cm-rich-editor overflow-visible"
                :disabled="props.disabled"
                :readonly="props.disabled"
            />
        </div>
    </div>
</template>
