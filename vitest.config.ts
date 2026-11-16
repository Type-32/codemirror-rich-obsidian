import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// The kit barrel re-exports `.vue` components; tests import it, so SFCs must compile (not render). They import Nuxt UI's
// components, which need Nuxt UI's Vite plugin to load: tests never render them, so an empty component stands in.
export default defineConfig({
    plugins: [vue()],
    test: {
        include: ['test/**/*.test.ts'],
        alias: [{ find: /^@nuxt\/ui\/components\/.+\.vue$/, replacement: fileURLToPath(new URL('./test/stub-component.ts', import.meta.url)) }],
    },
})
