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
import { indentOnInput, foldGutter, bracketMatching, foldKeymap, type LanguageSupport } from '@codemirror/language'
import { Compartment, EditorState, type Extension, type StateEffect } from '@codemirror/state'
import { languages } from '@codemirror/language-data'
import { shallowRef, onMounted, watch, computed } from 'vue'
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { lintKeymap } from '@codemirror/lint'
import { catppuccinLatte, catppuccinMocha } from '@catppuccin/codemirror'

const doc = defineModel<string>()
const props = withDefaults(defineProps<{
	class?: string
	language?: string // e.g., 'javascript', 'typescript', 'json', 'yaml', 'html', etc.
	bracketClosing?: boolean
	foldGutter?: boolean
	disabled?: boolean
	/** Custom theme for light mode. Defaults to Catppuccin Latte. */
	lightTheme?: Extension
	/** Custom theme for dark mode. Defaults to Catppuccin Mocha. */
	darkTheme?: Extension,
	colorMode?: string
}>(), {
	colorMode: 'dark'
})
const extensions = shallowRef<Extension[]>([])
const view = shallowRef<EditorView>()
const languageCompartment = new Compartment()
const themeCompartment = new Compartment()
// Prop changes that land before vue-codemirror6 emits @ready are queued here and flushed in handleReady.
let pendingEffects: StateEffect<unknown>[] = []

const currentTheme = computed(() =>
	props.colorMode === 'dark' ? (props.darkTheme || catppuccinMocha) : (props.lightTheme || catppuccinLatte)
)

async function loadLanguage(languageName?: string): Promise<LanguageSupport | null> {
	if (!languageName) return null
	const lower = languageName.toLowerCase()
	const lang = languages.find(l => l.name.toLowerCase() === lower || l.alias.some(a => a.toLowerCase() === lower))
	if (!lang) {
		console.warn(`Language not found: ${languageName}`)
		return null
	}
	try {
		return await lang.load()
	} catch (e) {
		console.warn(`Failed to load language: ${languageName}`, e)
		return null
	}
}

onMounted(async () => {
	const initialLanguage = await loadLanguage(props.language)

	extensions.value = [
		lineNumbers(),
		foldGutter(),
		highlightSpecialChars(),
		history(),
		drawSelection(),
		dropCursor(),
		EditorState.allowMultipleSelections.of(true),
		indentOnInput(),
		themeCompartment.of(currentTheme.value),
		bracketMatching(),
		closeBrackets(),
		autocompletion(),
		rectangularSelection(),
		crosshairCursor(),
		highlightActiveLine(),
		highlightActiveLineGutter(),
		highlightSelectionMatches(),
		languageCompartment.of(initialLanguage || []),
		keymap.of([
			...closeBracketsKeymap,
			...defaultKeymap,
			...searchKeymap,
			...historyKeymap,
			...foldKeymap,
			...completionKeymap,
			...lintKeymap
		]),
		EditorView.editable.of(!props.disabled),
	]
})

function reconfigure(effect: StateEffect<unknown>) {
	if (view.value) view.value.dispatch({ effects: effect })
	else pendingEffects.push(effect)
}

watch(() => props.language, async l => reconfigure(languageCompartment.reconfigure((await loadLanguage(l)) || [])))
watch(currentTheme, t => reconfigure(themeCompartment.reconfigure(t)))

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
	<div :class="props.class ? props.class : 'w-full h-full overflow-visible'">
		<ClientOnly class="overflow-visible">
			<div class="w-full cm-code-editor overflow-visible">
				<CodeMirror
					v-model="doc"
					placeholder="Your code here..."
					:basic="false"
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
		</ClientOnly>
	</div>
</template>
