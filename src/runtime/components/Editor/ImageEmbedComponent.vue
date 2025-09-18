<script setup lang="ts">
defineProps<{
    filePath: string;
    display?: string;
}>();
</script>

<template>
    <div class="p-3 grid grid-cols-1">
        <NuxtImg :src="filePath" class="w-full h-auto max-h-96 object-cover rounded-lg" format="jpeg" :quality="90" :alt="display"/>
		<div class="text-muted text-left text-xs select-none mt-1.5 text-pretty">{{ display }}</div>
    </div>
</template>
