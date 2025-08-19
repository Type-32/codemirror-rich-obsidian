<script setup lang="ts">
import ImageEmbedComponent from "~/components/Embeds/ImageEmbedComponent.vue";
import type {InternalLink} from "~/editor/plugins/linkMappingConfig";

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
    <div class="w-full overflow-visible">
        <Editor
            class="w-full h-full"
            :internal-link-map
            @internal-link-click="handleInternalLinkClick"
            @external-link-click="handleExternalLinkClick"
            :disabled="editorDisabled"
            debug
        />
        <USwitch v-model="editorDisabled" label="Disabled"/>
    </div>
</template>
