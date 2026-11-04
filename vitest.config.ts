import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// The kit barrel re-exports `.vue` components; tests import it, so SFCs must compile (not render).
export default defineConfig({
    plugins: [vue()],
    test: { include: ['test/**/*.test.ts'] },
})
