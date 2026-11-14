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
import { contextMenuSize, vueContextFacet, type MenuSize } from '../editor/plugins/hostAppConfig'
import { editorKeywordSearchPlugin, searchOptionsFacet } from '../editor/plugins/codemirror-editor-plugins/editorKeywordSearchPlugin'
import { propertiesPanel } from '../editor/plugins/codemirror-plugin-proses/propertiesPlugin'
import type {
    InternalLink,
    SpecialCodeBlockMapping,
    InternalLinkClickDetail,
    ExternalLinkClickDetail,
    PropertiesOptions,
    SearchOptions
} from '../editor/types/editor-types'
import { ref, shallowRef, onMounted, onBeforeUnmount, watch, getCurrentInstance, type AppContext } from 'vue';

const doc = defineModel<string>()
// `properties` needs an explicit default: Vue casts an absent prop whose type includes `false` to `false`.
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
}>(), { properties: () => ({}) })
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

onMounted(() => {
    cmExtensions.value = [
        EditorView.lineWrapping,
        history(),
        drawSelection(),
        rectangularSelection(),
        indentOnInput(),
        keymap.of(props.disabled ? [] : [...standardKeymap, ...historyKeymap, indentWithTab]),
        internalLinkCompartment.of(internalLinkMapFacet.of(props.internalLinkMap || [])),
        specialCodeBlockCompartment.of(specialCodeBlockMapFacet.of(props.specialCodeBlockMap || [])),
        bracketClosingCompartment.of(customBracketClosingConfig.of(props.bracketClosing ?? true)),
        foldGutterCompartment.of(props.foldGutter ?? true ? foldGutter() : []),
        editorKeywordSearchPlugin,
        vueContextFacet.of(vueContext),
        searchCompartment.of(searchOptionsFacet.of(props.searchOptions || { query: '' })),
        wysiwyg(),
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
watch(() => props.bracketClosing, v => reconfigure(bracketClosingCompartment.reconfigure(customBracketClosingConfig.of(v ?? true))))
watch(() => props.foldGutter, v => reconfigure(foldGutterCompartment.reconfigure(v ?? true ? foldGutter() : [])))
watch(() => props.searchOptions, o => reconfigure(searchCompartment.reconfigure(searchOptionsFacet.of(o || { query: '' }))), { deep: true })
watch(() => props.extensions, e => reconfigure(extensionsCompartment.reconfigure(e ?? [])))
watch(() => props.properties, p => reconfigure(propertiesCompartment.reconfigure(propertiesExtension(p))))
watch(() => props.contextMenuSize, s => reconfigure(contextMenuSizeCompartment.reconfigure(contextMenuSize.of(s))))

function handleReady(payload: { view: EditorView }) {
    view.value = payload.view
    if (pendingEffects.length) {
        payload.view.dispatch({ effects: pendingEffects })
        pendingEffects = []
    }
}

defineExpose({ view })
</script>

<template>
    <div :class="props.class ? props.class : 'w-full h-full overflow-visible'" ref="editorElement">
        <ClientOnly class="overflow-visible">
            <div class="w-full cm-rich-editor overflow-visible">
                <CodeMirror
                    v-model="doc"
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
        </ClientOnly>
    </div>
</template>
