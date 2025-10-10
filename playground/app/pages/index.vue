<script setup lang="ts">
import type { ExternalLinkClickDetail, InternalLink, InternalLinkClickDetail, SpecialCodeBlockMapping } from '#codemirror-rich-obsidian-editor/editor-types'
import { EditorImageEmbedComponent, EditorTestCustomCodeBlock } from '#components'

const router = useRouter()
const editorDisabled = ref(false), showFrontmatter = ref(false)
const editor = ref()
const $eutils = useEditorUtils(editor)

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
