<script setup lang="ts">
import CodeMirror from 'vue-codemirror6';
import { keymap, EditorView, drawSelection, rectangularSelection, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { defaultHighlightStyle, syntaxHighlighting, indentOnInput } from '@codemirror/language'
import { languages } from '@codemirror/language-data';
import wysiwyg from "~/editor/wysiwyg";

const doc = defineModel<string>()
const props = defineProps<{class?: string}>()
const extensions = shallowRef<any[]>([])
const view = shallowRef<EditorView>()
const ast = ref([])

onMounted(() => {
    const wysiwygPlugin = wysiwyg({
        lezer: {
            codeLanguages: languages,
        }
    })
    extensions.value = [
        EditorView.lineWrapping,
        wysiwygPlugin,
        history(),
        drawSelection(),
        rectangularSelection(),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle),
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
    ]
})

function handleReady(payload: any) {
    view.value = payload.view
}

function log(...args: any[]) {
    // console.log(...args)
}

function iterate() {
    ast.value = []
    view.value?.state?.tree.iterate({
        from: 0,
        to: view.value.state.doc.length,
        enter(node) {
            ast.value.push(`Node: ${node.name}, From: ${node.from}, To: ${node.to}, Text: "${view.value?.state.doc.sliceString(node.from, node.to)}"`)
            // To see highlight tags (more advanced, may need to inspect CM internals or a debug extension)
            // For now, node.name is the most critical.
        }
    });
}
</script>

<template>
    <div :class="props.class ? props.class : 'w-full h-full'">
        <ClientOnly>
            <div class="w-full cm-content">
                <CodeMirror
                    v-model="doc"
                    placeholder="Start typing your markdown content here..."
                    :autofocus="true"
                    :indent-with-tab="true"
                    :tab-size="4"
                    :extensions="extensions"
                    @ready="handleReady"
                    @change="log('change', $event)"
                    @focus="log('focus', $event)"
                    @blur="log('blur', $event)"
                    class="w-full h-full cm-content"
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
</style>