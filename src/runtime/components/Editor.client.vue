<script setup lang="ts">
import CodeMirror from 'vue-codemirror6'
import { keymap, EditorView, drawSelection, rectangularSelection } from '@codemirror/view'
import { standardKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { defaultHighlightStyle, syntaxHighlighting, indentOnInput, foldGutter } from '@codemirror/language'
import { Compartment, type Extension, type StateEffect } from '@codemirror/state'
import type { LanguageSupport } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import wysiwyg from '../editor/wysiwyg'
import { internalLinkMapFacet } from '../editor/plugins/linkMappingConfig'
import { specialCodeBlockMapFacet } from '../editor/plugins/specialCodeBlockMappingConfig'
import { customBracketClosingConfig } from '../editor/plugins/customBracketClosingConfig'
import { hostAppFacet } from '../editor/plugins/hostAppConfig'
import { editorKeywordSearchPlugin, searchOptionsFacet } from '../editor/plugins/codemirror-editor-plugins/editorKeywordSearchPlugin'
import type {
    InternalLink,
    SpecialCodeBlockMapping,
    InternalLinkClickDetail,
    ExternalLinkClickDetail,
    SearchOptions
} from '#codemirror-rich-obsidian-editor/editor-types'
import { ref, shallowRef, onMounted, onBeforeUnmount, watch, getCurrentInstance } from 'vue';

const doc = defineModel<string>()
const props = defineProps<{
    class?: string
    internalLinkMap?: InternalLink[]
    specialCodeBlockMap?: SpecialCodeBlockMapping[]
    bracketClosing?: boolean
    foldGutter?: boolean
    disabled?: boolean
    searchOptions?: SearchOptions
}>()
const emit = defineEmits<{
    'internal-link-click': [detail: InternalLinkClickDetail]
    'external-link-click': [detail: ExternalLinkClickDetail]
}>()
const extensions = shallowRef<Extension[]>([])
const view = shallowRef<EditorView>()
const internalLinkCompartment = new Compartment()
const specialCodeBlockCompartment = new Compartment()
const bracketClosingCompartment = new Compartment()
const foldGutterCompartment = new Compartment()
const searchCompartment = new Compartment()
const editorElement = ref<HTMLElement>()
const hostApp = getCurrentInstance()?.appContext.app ?? null
// Prop changes that land before vue-codemirror6 emits @ready are queued here and flushed in handleReady.
let pendingEffects: StateEffect<unknown>[] = []

function loadLanguage(info: string): Promise<LanguageSupport> | null {
    const lower = info.toLowerCase()
    const lang = languages.find(l => l.name.toLowerCase() === lower || l.alias.some(a => a.toLowerCase() === lower))
    return lang ? lang.load() : null
}

onMounted(() => {
    extensions.value = [
        EditorView.lineWrapping,
        history(),
        drawSelection(),
        rectangularSelection(),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle),
        keymap.of(props.disabled ? [] : [...standardKeymap, ...historyKeymap, indentWithTab]),
        internalLinkCompartment.of(internalLinkMapFacet.of(props.internalLinkMap || [])),
        specialCodeBlockCompartment.of(specialCodeBlockMapFacet.of(props.specialCodeBlockMap || [])),
        bracketClosingCompartment.of(customBracketClosingConfig.of(props.bracketClosing ?? true)),
        foldGutterCompartment.of(props.foldGutter ?? true ? foldGutter() : []),
        editorKeywordSearchPlugin,
        hostAppFacet.of(hostApp),
        searchCompartment.of(searchOptionsFacet.of(props.searchOptions || { query: '' })),
        wysiwyg({ lezer: { codeLanguages: loadLanguage } }),
        EditorView.editable.of(!props.disabled),
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
                    :extensions="extensions"
                    @ready="handleReady"
                    class="w-full h-full cm-rich-editor overflow-visible"
                    :disabled="props.disabled"
                    :readonly="props.disabled"
                />
            </div>
        </ClientOnly>
    </div>
</template>
