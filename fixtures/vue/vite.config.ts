// The editor in a Vue app with Nuxt UI, no Nuxt (Nuxt UI's Vue setup). `bunx vite --config fixtures/vue/vite.config.ts` (after `bun run prepack`).
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'

export default defineConfig({
    root: import.meta.dirname,
    plugins: [vue(), ui()],
})
