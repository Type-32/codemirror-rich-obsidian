<script setup lang="ts">
import ImageEmbedComponent from "~/components/Embeds/ImageEmbedComponent.vue";
import type {InternalLink} from "~/editor/plugins/linkMappingConfig";
import type { SpecialCodeBlockMapping } from '~/editor/plugins/specialCodeBlockMappingConfig'
import TestCustomCodeBlock from '~/components/SpecialCodeBlocks/TestCustomCodeBlock.vue'

const router = useRouter()
const editorDisabled = ref(false)

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
        embedComponent: ImageEmbedComponent,
    }
]);

const specialCodeBlockMap = ref<SpecialCodeBlockMapping[]>([
    {
        codeInfo: 'test',
        component: TestCustomCodeBlock
    }
])


const handleInternalLinkClick = (detail: { path: string, subpath?: string, display?: string, type: 'internal-link' | 'embed' }) => {
    console.log("Internal link clicked:", detail);
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


</script>

<template>
    <div class="w-full overflow-visible flex flex-col justify-start items-center my-10">
        <Editor
            class="h-full w-2xl"
            :internal-link-map
            :special-code-block-map
            @internal-link-click="handleInternalLinkClick"
            @external-link-click="handleExternalLinkClick"
            :disabled="editorDisabled"
            :fold-gutter="false"
            debug
        />
        <USwitch v-model="editorDisabled" label="Disabled"/>
    </div>
</template>
