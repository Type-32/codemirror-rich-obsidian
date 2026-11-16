<script setup lang="ts">
import { ref } from 'vue'
import { Editor } from '@type32/codemirror-rich-obsidian-editor/vue'
import { blockDragHandle, selectionToolbar, slashMenu } from '@type32/codemirror-rich-obsidian-editor/ext'
import type { InternalLink } from '@type32/codemirror-rich-obsidian-editor'

const doc = ref(`---
status: draft
tags:
  - vue
---
# Vue + Nuxt UI

Some **bold** text and a [[My Note]] link. Type \`[[\` or \`/\`.

| a | b |
| - | - |
| c | d |

> [!note] A callout
> | x |
> | - |
> | y |
`)
const links: InternalLink[] = [{ name: 'My Note', referenceId: 'my-note', headings: ['Overview'] }, { name: 'Another Note', referenceId: 'another' }]
const extensions = [selectionToolbar(), slashMenu(), blockDragHandle()]
</script>

<template>
    <UApp>
        <main style="max-width: 48rem; margin: 2rem auto">
            <Editor v-model="doc" :internal-link-map="links" :extensions="extensions" :fold-gutter="false" />
            <pre data-testid="model" style="display: none">{{ doc }}</pre>
        </main>
    </UApp>
</template>
