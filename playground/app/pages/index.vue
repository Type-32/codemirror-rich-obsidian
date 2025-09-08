<script setup lang="ts">
import type { InternalLink, SpecialCodeBlockMapping } from '#codemirror-rich-obsidian-editor/editor-types'
import { EditorImageEmbedComponent, EditorTestCustomCodeBlock } from '#components'

const router = useRouter()
const editorDisabled = ref(false), showFrontmatter = ref(false)
const editor = ref()
const $eutils = useEditorUtils(editor)

const internalLinkMap = ref<InternalLink[]>([
    {
        internalLinkName: "My Note",
        redirectToPath: "/notes/my-note",
    },
    {
        internalLinkName: "Another Note",
        redirectToPath: "/notes/another-note",
    },
    {
        internalLinkName: "Kthalatir.png",
        filePath: "/Kthalatir.png",
        redirectToPath: "/images/kthalatir",
        embedComponent: EditorImageEmbedComponent,
    }
]);

const specialCodeBlockMap = ref<SpecialCodeBlockMapping[]>([
    {
        codeInfo: 'test',
        component: EditorTestCustomCodeBlock
    }
])


const handleInternalLinkClick = (detail: { path: string, subpath?: string, display?: string, type: 'internal-link' | 'embed' }) => {
    // console.log("Internal link clicked:", detail);
    const link = internalLinkMap.value.find(l => l.internalLinkName === detail.path);
    if (link) {
        router.push(link.redirectToPath);
    }
};

const handleExternalLinkClick = (detail: { url: string, text?: string }) => {
    if (detail.url) {
        window.open(detail.url, '_blank');
    }
};

function test() {
	console.log($eutils.getDocAst())
}

</script>

<template>
    <div class="w-full overflow-visible flex flex-col justify-start items-center my-10">
        <Editor
			ref="editor"
            class="h-full w-2xl"
            :internal-link-map
            :special-code-block-map
            @internal-link-click="handleInternalLinkClick"
            @external-link-click="handleExternalLinkClick"
            :disabled="editorDisabled"
            :fold-gutter="false"
			:show-frontmatter
            debug
        />
        <USwitch v-model="editorDisabled" label="Disabled"/>
		<UButton @click="test" label="Test"/>
    </div>
</template>
