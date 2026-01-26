<script setup lang="ts">
import type { ExternalLinkClickDetail, InternalLink, InternalLinkClickDetail, SpecialCodeBlockMapping } from '#codemirror-rich-obsidian-editor/editor-types'
import { EditorImageEmbedComponent, EditorTestCustomCodeBlock } from '#components'
import type { TabsItem } from '@nuxt/ui'

const router = useRouter()
const editorDisabled = ref(false), showFrontmatter = ref(false)
const editor = ref()
const $eutils = useEditorUtils(editor)
const content = ref('')
const codeLanguage = ref('js')

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
        component: EditorTestCustomCodeBlock
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

</script>

<template>
	<UTabs :items="tabs" class="w-full" variant="link" :ui="{ trigger: 'grow' }">
		<template #rich>
			<div class="w-full overflow-visible flex flex-col justify-start items-center my-10">
				<Editor
					v-model="content"
					ref="editor"
					class="h-full w-2xl"
					:internal-link-map
					:special-code-block-map="specialCodeBlockMap"
					@internal-link-click="handleInternalLinkClick"
					@external-link-click="handleExternalLinkClick"
					:disabled="editorDisabled"
					:fold-gutter="false"
					debug
				/>
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
	<UButton @click="test" label="Test"/>
</template>
