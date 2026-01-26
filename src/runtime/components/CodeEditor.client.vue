<script setup lang="ts">
import CodeMirror from 'vue-codemirror6'
import {
	EditorView,
	drawSelection,
	rectangularSelection,
	highlightActiveLine,
	highlightActiveLineGutter,
	lineNumbers,
	highlightSpecialChars,
	dropCursor,
	crosshairCursor,
	keymap,
} from '@codemirror/view'
import { history, historyKeymap, defaultKeymap } from '@codemirror/commands'
import {
	defaultHighlightStyle,
	syntaxHighlighting,
	indentOnInput,
	foldGutter,
	syntaxTree,
	bracketMatching,
	foldKeymap,
} from '@codemirror/language'
import { Compartment, EditorState } from '@codemirror/state'
import { type LanguageSupport } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { ref, shallowRef, onMounted, watch, computed } from 'vue'
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { lintKeymap } from '@codemirror/lint'
import type { Extension } from '@codemirror/state'
import { catppuccinLatte, catppuccinMocha } from '@catppuccin/codemirror'
import type { SearchOptions } from '#codemirror-rich-obsidian-editor/editor-types'

const doc = defineModel<string>()
const props = defineProps<{
	class?: string
	language?: string // e.g., 'javascript', 'typescript', 'json', 'yaml', 'html', etc.
	bracketClosing?: boolean
	foldGutter?: boolean
	disabled?: boolean
	debug?: boolean
	searchOptions?: SearchOptions
	/**
	 * Custom theme for light mode. Defaults to Catppuccin Latte.
	 * Pass a CodeMirror Extension (e.g., from @codemirror/theme-one-dark)
	 */
	lightTheme?: Extension
	/**
	 * Custom theme for dark mode. Defaults to Catppuccin Mocha.
	 * Pass a CodeMirror Extension (e.g., from @codemirror/theme-one-dark)
	 */
	darkTheme?: Extension
}>()
const emit = defineEmits<{}>()
const extensions = shallowRef<any[]>([])
const view = shallowRef<EditorView>()
const ast = ref([])
const languageCompartment = new Compartment()
const themeCompartment = new Compartment()

// Get Nuxt's color mode
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

// Get theme based on color mode and props
const currentTheme = computed(() => {
	if (isDark.value) {
		return props.darkTheme || catppuccinMocha
	}
	return props.lightTheme || catppuccinLatte
})

/**
 * Loads a language support extension based on the language name
 */
async function loadLanguage(languageName?: string): Promise<LanguageSupport | null> {
	if (!languageName) return null

	const lang = languages.find(l =>
		l.name.toLowerCase() === languageName.toLowerCase() ||
		l.alias.map(a => a.toLowerCase()).includes(languageName.toLowerCase())
	)

	if (lang) {
		try {
			return await lang.load()
		} catch (e) {
			console.warn(`Failed to load language: ${languageName}`, e)
			return null
		}
	}

	console.warn(`Language not found: ${languageName}`)
	return null
}

onMounted(async () => {
	// Load initial language support
	const initialLanguage = await loadLanguage(props.language)

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
		// Theme compartment - switches between light and dark
		themeCompartment.of(currentTheme.value),
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
		// Language support compartment (can be reconfigured)
		languageCompartment.of(initialLanguage || []),
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
		EditorView.editable.of(!props.disabled),
	]
})

// Watch for language prop changes and dynamically reload language support
watch(
	() => props.language,
	async (newLanguage) => {
		if (view.value) {
			const languageSupport = await loadLanguage(newLanguage)
			view.value.dispatch({
				effects: languageCompartment.reconfigure(languageSupport || []),
			})
		}
	}
)

// Watch for color mode changes and switch theme
watch(
	currentTheme,
	(newTheme) => {
		if (view.value) {
			view.value.dispatch({
				effects: themeCompartment.reconfigure(newTheme),
			})
		}
	}
)

function handleReady(payload: any) {
	view.value = payload.view
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
	<div :class="props.class ? props.class : 'w-full h-full overflow-visible'">
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
