<script setup lang="ts">
defineProps<{
    filePath: string;
}>();
</script>

<template>
    <div class="p-3">
        <NuxtImg :src="filePath" class="w-full h-auto object-cover rounded-lg" format="jpeg" :quality="80" alt=""/>
    </div>
</template>