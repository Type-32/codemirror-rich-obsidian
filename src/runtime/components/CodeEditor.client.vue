<script setup lang="ts">
import CodeMirror from 'vue-codemirror6'
import {
	keymap,
	EditorView,
	drawSelection,
	rectangularSelection,
	highlightActiveLine,
	highlightActiveLineGutter,
	ViewPlugin,
	Decoration,
	ViewUpdate, lineNumbers, highlightSpecialChars, dropCursor, crosshairCursor,
} from '@codemirror/view'
import type { DecorationSet } from '@codemirror/view'
import { standardKeymap, history, historyKeymap, indentWithTab, defaultKeymap } from '@codemirror/commands'
import {
	defaultHighlightStyle,
	syntaxHighlighting,
	indentOnInput,
	foldGutter,
	syntaxTree,
	bracketMatching, foldKeymap,
} from '@codemirror/language'
import { Compartment, EditorState, RangeSetBuilder } from '@codemirror/state'
import { LanguageSupport, LRLanguage } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import wysiwyg from '../editor/wysiwyg'
import { internalLinkMapFacet } from '../editor/plugins/linkMappingConfig'
import { specialCodeBlockMapFacet } from '../editor/plugins/specialCodeBlockMappingConfig'
import { customBracketClosingConfig } from '../editor/plugins/customBracketClosingConfig'
import { editorKeywordSearchPlugin, searchOptionsFacet } from '../editor/plugins/codemirror-editor-plugins/editorKeywordSearchPlugin'
import type {
	InternalLink,
	SpecialCodeBlockMapping,
	InternalLinkClickDetail,
	ExternalLinkClickDetail,
	SearchOptions
} from '#codemirror-rich-obsidian-editor/editor-types'
import {ref, shallowRef, computed, onMounted, onBeforeUnmount, unref, watch} from 'vue';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { lintKeymap } from '@codemirror/lint'

const doc = defineModel<string>()
const props = defineProps<{
	class?: string
	internalLinkMap?: InternalLink[]
	specialCodeBlockMap?: SpecialCodeBlockMapping[]
	bracketClosing?: boolean
	foldGutter?: boolean
	disabled?: boolean
	debug?: boolean
	searchOptions?: SearchOptions
}>()
const emit = defineEmits<{
	'internal-link-click': [detail: InternalLinkClickDetail]
	'external-link-click': [detail: ExternalLinkClickDetail]
}>()
const extensions = shallowRef<any[]>([])
const view = shallowRef<EditorView>()
const ast = ref([])
const internalLinkCompartment = new Compartment()
const specialCodeBlockCompartment = new Compartment()
const bracketClosingCompartment = new Compartment()
const foldGutterCompartment = new Compartment()
const showFrontmatterCompartment = new Compartment()
const searchCompartment = new Compartment()
const editorElement = ref<HTMLElement>()
const keymaps = computed(() => {
	return props.disabled ? keymap.of([]) : keymap.of([...standardKeymap, ...historyKeymap, indentWithTab])
})

async function loadLanguage(info: string): Promise<LanguageSupport> {
	const lang = languages.find(l => l.name.toLowerCase() === info.toLowerCase() || l.alias.map(a => a.toLowerCase()).includes(info.toLowerCase()))
	if (lang) {
		return await lang.load()
	}
	// throw new Error(`Language ${info} not found`);
}

onMounted(() => {
	// const wysiwygPlugin = wysiwyg({
	// 	lezer: {
	// 		codeLanguages: loadLanguage,
	// 	},
	// })
	extensions.value = [
		lineNumbers(),
		// A gutter with code folding markers
		foldGutter(),
		// Replace non-printable characters with placeholders
		highlightSpecialChars(),
		// The undo history
		history(),
		// Replace native cursor/selection with our own
		drawSelection(),
		// Show a drop cursor when dragging over the editor
		dropCursor(),
		// Allow multiple cursors/selections
		EditorState.allowMultipleSelections.of(true),
		// Re-indent lines when typing specific input
		indentOnInput(),
		// Highlight syntax with a default style
		syntaxHighlighting(defaultHighlightStyle),
		// Highlight matching brackets near cursor
		bracketMatching(),
		// Automatically close brackets
		closeBrackets(),
		// Load the autocompletion system
		autocompletion(),
		// Allow alt-drag to select rectangular regions
		rectangularSelection(),
		// Change the cursor to a crosshair when holding alt
		crosshairCursor(),
		// Style the current line specially
		highlightActiveLine(),
		// Style the gutter for current line specially
		highlightActiveLineGutter(),
		// Highlight text that matches the selected text
		highlightSelectionMatches(),
		keymap.of([
			// Closed-brackets aware backspace
			...closeBracketsKeymap,
			// A large set of basic bindings
			...defaultKeymap,
			// Search-related keys
			...searchKeymap,
			// Redo/undo keys
			...historyKeymap,
			// Code folding bindings
			...foldKeymap,
			// Autocompletion keys
			...completionKeymap,
			// Keys related to the linter system
			...lintKeymap
		]),
		EditorView.editable.of(unref(!props.disabled)),
	]
	if (editorElement.value) {
		editorElement.value.addEventListener('internal-link-click', handleInternalLinkClick as EventListener)
		editorElement.value.addEventListener('external-link-click', handleExternalLinkClick as EventListener)
	}
})

onBeforeUnmount(() => {
	if (editorElement.value) {
		editorElement.value.removeEventListener('internal-link-click', handleInternalLinkClick as EventListener)
		editorElement.value.removeEventListener('external-link-click', handleExternalLinkClick as EventListener)
	}
})

function handleInternalLinkClick(event: CustomEvent<InternalLinkClickDetail>) {
	emit('internal-link-click', event.detail)
}

function handleExternalLinkClick(event: CustomEvent<ExternalLinkClickDetail>) {
	emit('external-link-click', event.detail)
}

watch(
	() => props.internalLinkMap,
	(newMap) => {
		if (view.value) {
			view.value.dispatch({
				effects: internalLinkCompartment.reconfigure(internalLinkMapFacet.of(newMap || [])),
			})
		}
	},
	{ deep: true }
)

watch(
	() => props.specialCodeBlockMap,
	(newMap) => {
		if (view.value) {
			view.value.dispatch({
				effects: specialCodeBlockCompartment.reconfigure(specialCodeBlockMapFacet.of(newMap || [])),
			})
		}
	},
	{ deep: true }
)

watch(
	() => props.bracketClosing,
	(newValue) => {
		if (view.value) {
			view.value.dispatch({
				effects: bracketClosingCompartment.reconfigure(customBracketClosingConfig.of(newValue ?? true)),
			})
		}
	},
)

watch(
	() => props.foldGutter,
	(newValue) => {
		if (view.value) {
			view.value.dispatch({
				effects: foldGutterCompartment.reconfigure(newValue ?? true ? foldGutter() : []),
			})
		}
	},
)

watch(
	() => props.searchOptions,
	(newOptions) => {
		if (view.value) {
			view.value.dispatch({
				effects: searchCompartment.reconfigure(searchOptionsFacet.of(newOptions || { query: '' }))
			})
		}
	},
	{ deep: true }
)

function handleReady(payload: any) {
	view.value = payload.view
}

function log(...args: any[]) {
	// console.log(...args)
}

function iterate() {
	ast.value = []
	try {
		//@ts-ignore
		view.value?.state?.tree.iterate({
			from: 0,
			to: view.value.state.doc.length,
			//@ts-ignore
			enter(node) {
				// @ts-ignore
				ast.value.push(`Node: ${node.name}, From: ${node.from}, To: ${node.to}, Text: "${view.value?.state.doc.sliceString(node.from, node.to)}"`)
				// To see highlight tags (more advanced, may need to inspect CM internals or a debug extension)
				// For now, node.name is the most critical.
			},
		})
	} catch (e) {
		console.log(e)
	}
}

defineExpose({
	view,
})
</script>

<template>
	<div :class="props.class ? props.class : 'w-full h-full overflow-visible'" ref="editorElement">
		<ClientOnly class="overflow-visible">
			<div class="w-full cm-code-editor overflow-visible">
				<CodeMirror
					v-model="doc"
					placeholder="Your code here..."
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
					class="w-full h-full cm-code-editor overflow-visible"
					:disabled="props.disabled"
					:readonly="props.disabled"
				/>
			</div>
			<template v-if="props.debug">
				<UButton label="Iterate AST" @click="iterate" />
				<div class="grid grid-cols-1 gap-2 py-2 w-full">
					<div v-for="(content, index) in ast" :key="index">{{ content }}</div>
				</div>
			</template>
		</ClientOnly>
	</div>
</template>

<style>
@reference "../assets/css/editor.css";

.cm-cursor {
	@apply border-l-primary! border-l-[1.8px]! rounded-lg!;
}

.cm-selectionBackground {
	@apply bg-primary/30! z-[150];
}

.cm-selectionLayer {
	@apply z-[150]!;
	pointer-events: none;
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
