<script setup lang="ts">
defineProps<{ codeContent?: string }>()
const clicks = ref(0)
</script>

<template>
    <div class="m-3 p-3 border border-default rounded">
        <div>This is a test codeblock.</div>
        <div>{{ codeContent }}</div>
        <UButton :label="`You could also add buttons in here: ${clicks}`" @click="() => { clicks += 1 }" />
    </div>
</template>
