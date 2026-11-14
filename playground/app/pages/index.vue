<script setup lang="ts">
import type { ExternalLinkClickDetail, InternalLink, InternalLinkClickDetail, SpecialCodeBlockMapping } from '#codemirror-rich-obsidian-editor/editor-types'
import { EditorImageEmbedComponent, TestCustomCodeBlock } from '#components'
import type { TabsItem } from '@nuxt/ui'
import { EditorView } from '@codemirror/view'
import { editorLabels, headingsField, type Heading } from '@type32/codemirror-rich-obsidian-editor/kit'
import { blockDragHandle, selectionToolbar, slashMenu } from '@type32/codemirror-rich-obsidian-editor/ext'
import { aiAssistant } from '@type32/codemirror-rich-obsidian-editor/ext/ai'
import { uppercaseButton, wordCount } from '~/extensions'

const router = useRouter()
const editorDisabled = ref(false), showFrontmatter = ref(false)
const editor = ref()
const $eutils = useEditorUtils(editor)
const content = useState<string>('content', () => '')
const codeLanguage = ref('js')

const toolbarOn = ref(true), uppercaseOn = ref(true), slashOn = ref(true), handleOn = ref(true), aiOn = ref(true), aiDirect = ref(false), zhLabels = ref(false)
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
])

const internalLinkMap = ref<InternalLink[]>([
    {
        name: "My Note",
        filePath: "/notes/my-note",
        referenceId: "/notes/my-note",
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
    }
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
    if (detail.url) {
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
	<UColorModeButton/>
	<UButton @click="test" label="Test"/>
</template>
