<script setup lang="ts">
import type { EmbedMount, ExternalLinkClickDetail, InternalLink, InternalLinkClickDetail, SpecialCodeBlockMapping } from '@type32/codemirror-rich-obsidian-editor'
import { EditorImageEmbedComponent, TestCustomCodeBlock } from '#components'
import type { TabsItem } from '@nuxt/ui'
import { EditorView } from '@codemirror/view'
import { editorLabels, headingsField, type Heading } from '@type32/codemirror-rich-obsidian-editor/kit'
import { blockDragHandle, selectionToolbar, slashMenu } from '@type32/codemirror-rich-obsidian-editor/ext'
import { aiAssistant } from '@type32/codemirror-rich-obsidian-editor/ext/ai'
import { markdownOptions, uppercaseButton, variables, wordCount } from '~/extensions'

const router = useRouter()
const editorDisabled = ref(false), showFrontmatter = ref(false)
const editor = ref()
const $eutils = useEditorUtils(editor)
const content = useState<string>('content', () => '')
const codeLanguage = ref('js')

const toolbarOn = ref(true), uppercaseOn = ref(true), slashOn = ref(true), handleOn = ref(true), aiOn = ref(true), aiDirect = ref(false), zhLabels = ref(false), variablesOn = ref(true)
// The README's "Labels / localization" example.
const zh = editorLabels.of({ bold: '粗体', heading1: '标题 1', moveUp: '上移', askAi: '问 AI', 'ui.ai.accept': '接受', 'ui.ai.discard': '放弃' })

// Host-side outline: the README's "Table of contents" snippet.
const outline = ref<Heading[]>([])
const outlineListener = [headingsField, EditorView.updateListener.of((u) => {
	outline.value = u.state.field(headingsField)
})]
function jumpTo(h: Heading) {
	const view: EditorView | undefined = editor.value?.view
	view?.dispatch({ selection: { anchor: h.from }, effects: EditorView.scrollIntoView(h.from, { y: 'start' }) })
	view?.focus()
}

// `[]` is an empty extension: switch one off without touching the others.
const extensions = computed(() => [
	toolbarOn.value ? selectionToolbar() : [],
	uppercaseOn.value ? uppercaseButton : [],
	slashOn.value ? slashMenu() : [],
	handleOn.value ? blockDragHandle() : [],
	aiOn.value ? aiAssistant(aiDirect.value ? { endpoint: { baseURL: 'http://localhost:11434/v1', model: 'gemma4:latest' } } : {}) : [],
	outlineListener,
	wordCount,
	zhLabels.value ? zh : [],
	variablesOn.value ? variables : [],
])

// A plain-DOM embed (`embedMount`, no component). `window.__liveEmbeds` counts mounted ones: each unmounts when it goes.
const liveEmbed: EmbedMount = (el, props) => {
	const w = window as unknown as { __liveEmbeds?: number }
	w.__liveEmbeds = (w.__liveEmbeds ?? 0) + 1
	el.textContent = `Plain DOM embed of ${props.filePath}`
	el.style.cssText = 'padding: 0.75rem; border: 1px dashed var(--ui-border); border-radius: 0.5rem; font-size: 0.875rem'
	return () => { w.__liveEmbeds!-- }
}

const internalLinkMap = ref<InternalLink[]>([
    {
        name: "My Note",
        filePath: "/notes/my-note",
        referenceId: "/notes/my-note",
        aliases: ["Personal notes"],
        headings: ["Overview", "Ideas", "Ideas for later"],
        blocks: [{ id: "key", text: "The one thing to remember" }],
    },
    {
        name: "Another Note",
        filePath: "/notes/another-note",
        referenceId: "/notes/another-note",
    },
    {
        name: "Test1",
        filePath: "/notes/test1",
        referenceId: "/notes/test1",
    },
    {
        name: "Test1",
        filePath: "/notes/other/test1",
        referenceId: "/notes/other/test1",
    },
    {
        name: "Kthalatir.png",
        filePath: "/Kthalatir.png",
        referenceId: "/images/kthalatir",
        embedComponent: EditorImageEmbedComponent,
    },
	{
		name: "Widget.canvas",
		filePath: "/Widget.canvas",
		referenceId: "/widget",
		embedMount: liveEmbed,
	},
	{
		name: "极乐迪斯科",
		filePath: "/disco-elysium.md",
		referenceId: "/de"
	},
]);

const specialCodeBlockMap = ref<SpecialCodeBlockMapping[]>([
    {
        codeInfo: 'test',
        component: TestCustomCodeBlock
    }
])


const handleInternalLinkClick = (detail: InternalLinkClickDetail) => {
    console.log("Internal link clicked:", detail);
    // const link = internalLinkMap.value.find(l => l.name === detail.path);
    // if (link) {
    //     router.push(link.redirectToPath);
    // }
};

const handleExternalLinkClick = (detail: ExternalLinkClickDetail) => {
    if (/^(https?|mailto):/i.test(detail.url)) {
        window.open(detail.url, '_blank');
    }
};

function test() {
	console.log($eutils.getDocAst())
}

const tabs = ref<TabsItem[]>([
	{
		label: 'Rich Text Editor',
		slot: 'rich' as const
	},
	{
		label: 'Code Editor',
		slot: 'code' as const
	}
])

const $eu = useEditorUtils(editor)
const $ef = useEditorFrontmatter(editor)

function test2() {
	console.log($eu.getDocAst())
	console.log($eu.getDoc())
	console.log($ef.getFrontmatter())
}

function test3() {
	console.log(parseFrontmatter(content.value))
}

</script>

<template>
	<UTabs :items="tabs" class="w-full" variant="link" :ui="{ trigger: 'grow' }">
		<template #rich>
			<div class="w-full overflow-visible flex flex-col justify-start items-center my-10">
				<UButton @click="test2" label="Test 2"/>
				<UButton @click="test3" label="Test 3"/>
				<div class="flex items-start gap-6">
					<nav class="w-48 sticky top-4 flex flex-col text-sm" aria-label="Outline">
						<button
							v-for="h in outline"
							:key="h.from"
							class="text-start truncate text-muted hover:text-default py-0.5"
							:style="{ paddingInlineStart: `${(h.level - 1) * 0.75}rem` }"
							@click="jumpTo(h)"
						>{{ h.text }}</button>
					</nav>
					<Editor
						v-model="content"
						ref="editor"
						class="h-full w-2xl"
						:internal-link-map
						:special-code-block-map="specialCodeBlockMap"
						@internal-link-click="handleInternalLinkClick"
						@external-link-click="handleExternalLinkClick"
						:disabled="editorDisabled"
						:extensions="extensions"
						:fold-gutter="false"
						context-menu-size="sm"
						:markdown="variablesOn ? markdownOptions : undefined"
						:properties="{
							types: { aliases: 'aliases', cssclasses: 'list', tags: 'tags', cover: 'text', description: 'text', status: 'text', rating: 'number', done: 'checkbox', created: 'date', updated: 'datetime' },
							valueSuggestions: key => key === 'tags' ? ['kthalatir', 'lab/parity', 'draft'] : key === 'status' ? ['draft', 'review', 'done'] : [],
						}"
						debug
					/>
					<ChatPanel :view="editor?.view" class="sticky top-4" />
				</div>
			</div>
		</template>
		<template #code>
			<div class="w-full overflow-visible flex flex-col justify-start items-center my-10">
				<UInput v-model="codeLanguage"/>
				<CodeEditor
					v-model="content"
					class="h-full w-2xl"
					:disabled="editorDisabled"
					:language="codeLanguage"
				/>
			</div>
		</template>
	</UTabs>
	<USwitch v-model="editorDisabled" label="Disabled"/>
	<USwitch v-model="toolbarOn" label="Selection toolbar"/>
	<USwitch v-model="uppercaseOn" label="Uppercase button"/>
	<USwitch v-model="slashOn" label="Slash menu"/>
	<USwitch v-model="handleOn" label="Block drag handle"/>
	<USwitch v-model="aiOn" label="AI assistant"/>
	<USwitch v-model="aiDirect" label="AI: call Ollama from the browser"/>
	<USwitch v-model="zhLabels" label="Chinese labels (editorLabels)"/>
	<USwitch v-model="variablesOn" label="{{variables}}: host syntax (markdown) + highlight (nestedExtensions)"/>
	<UColorModeButton/>
	<UButton @click="test" label="Test"/>
</template>
