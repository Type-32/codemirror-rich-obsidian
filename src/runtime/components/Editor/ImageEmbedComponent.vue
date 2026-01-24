<script setup lang="ts">
defineProps<{
    filePath: string;
    display?: string;
}>();
console.log('upda')
</script>

<template>
    <div class="p-3 grid grid-cols-1">
        <img :src="filePath" class="h-auto min-h-12 max-h-96 object-contain rounded-lg" :alt="display"/>
		<div class="text-muted text-left text-xs select-none mt-1.5 text-pretty">{{ display }}</div>
    </div>
</template>
