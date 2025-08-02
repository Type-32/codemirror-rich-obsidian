<script setup lang="ts">
import CodeMirror from 'vue-codemirror6';
import { keymap, EditorView, drawSelection, rectangularSelection, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import {defaultHighlightStyle, syntaxHighlighting, indentOnInput, indentUnit} from '@codemirror/language'
import {Compartment} from "@codemirror/state";
import { languages } from '@codemirror/language-data';
import wysiwyg from "~/editor/wysiwyg";
import {type InternalLink, internalLinkMapFacet} from "~/editor/plugins/linkMappingConfig";
import {autocompletion, closeBracketsKeymap, completionKeymap} from "@codemirror/autocomplete";

const doc = defineModel<string>()
const props = defineProps<{class?: string, internalLinkMap?: InternalLink[]}>()
const emit = defineEmits(['internal-link-click', 'external-link-click']);
const extensions = shallowRef<any[]>([])
const view = shallowRef<EditorView>()
const ast = ref([])
const internalLinkCompartment = new Compartment();
const editorElement = ref<HTMLElement>()

onMounted(() => {
    const wysiwygPlugin = wysiwyg({
        lezer: {
            codeLanguages: languages,
        }
    })
    extensions.value = [
        EditorView.lineWrapping,
        autocompletion(),
        history(),
        drawSelection(),
        rectangularSelection(),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle),
        // highlightActiveLine(),
        // highlightActiveLineGutter(),
        keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            ...completionKeymap,
            indentWithTab
        ]),
        internalLinkCompartment.of(internalLinkMapFacet.of(props.internalLinkMap || [])),
        wysiwygPlugin,
    ]
    if (editorElement.value) {
        editorElement.value.addEventListener('internal-link-click', handleInternalLinkClick as EventListener);
        editorElement.value.addEventListener('external-link-click', handleExternalLinkClick as EventListener);
    }
})

onBeforeUnmount(() => {
    if (editorElement.value) {
        editorElement.value.removeEventListener('internal-link-click', handleInternalLinkClick as EventListener);
        editorElement.value.removeEventListener('external-link-click', handleExternalLinkClick as EventListener);
    }
});

function handleInternalLinkClick(event: CustomEvent) {
    emit('internal-link-click', event.detail);
}

function handleExternalLinkClick(event: CustomEvent) {
    emit('external-link-click', event.detail);
}

watch(() => props.internalLinkMap, (newMap) => {
    if (view.value) {
        view.value.dispatch({
            effects: internalLinkCompartment.reconfigure(internalLinkMapFacet.of(newMap || []))
        });
    }
}, { deep: true });

function handleReady(payload: any) {
    view.value = payload.view
}

function log(...args: any[]) {
    // console.log(...args)
}

function iterate() {
    ast.value = []
    //@ts-ignore
    view.value?.state?.tree.iterate({
        from: 0,
        to: view.value.state.doc.length,
        //@ts-ignore
        enter(node) {
            //@ts-ignore
            ast.value.push(`Node: ${node.name}, From: ${node.from}, To: ${node.to}, Text: "${view.value?.state.doc.sliceString(node.from, node.to)}"`)
            // To see highlight tags (more advanced, may need to inspect CM internals or a debug extension)
            // For now, node.name is the most critical.
        }
    });
}
</script>

<template>
    <div :class="props.class ? props.class : 'w-full h-full overflow-visible'" ref="editorElement">
        <ClientOnly class="overflow-visible">
            <div class="w-full cm-content overflow-visible">
                <CodeMirror
                    v-model="doc"
                    placeholder="Start typing your markdown content here..."
                    :autofocus="true"
                    :indent-with-tab="true"
                    :tab-size="4"
                    :tab="true"
                    :indent-unit="'\t'"
                    :extensions="extensions"
                    @ready="handleReady"
                    @change="log('change', $event)"
                    @focus="log('focus', $event)"
                    @blur="log('blur', $event)"
                    class="w-full h-full cm-content overflow-visible"
                 />
            </div>
            <UButton label="Iterate" @click="iterate"/>
            <div class="grid grid-cols-1 gap-2 py-2">
                <div v-for="(content, index) in ast" :key="index">{{content}}</div>
            </div>
        </ClientOnly>
    </div>
</template>

<style>
@reference "~/assets/css/main.css";

.cm-cursor {
    @apply border-l-primary! border-l-[1.6px]!;
}

.cm-selectionBackground {
    @apply bg-primary/50! z-120!;
}

div[contenteditable='true']:focus {
    @apply outline-none border-none h-full shadow-none;
}

.cm-focused {
    @apply outline-none!;
}

.cm-placeholder {
    @apply font-editor text-muted;
}

.cm-activeLine {
    @apply bg-none! border-l-primary border-l-4 relative -left-1 content-[""] mask-no-clip overflow-visible;
}
</style>