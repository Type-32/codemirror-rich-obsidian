// Read by `nuxt-module-build` (unbuild). `dist/editor.css` is built with the module, before unbuild checks that every
// file `package.json` exports exists (which it does before `build:done`).
import { buildEditorCss } from './scripts/build-css.mjs'

export default {
    hooks: {
        async 'rollup:done'(ctx: { options: { stub: boolean } }) {
            if (!ctx.options.stub) await buildEditorCss()
        },
    },
}
