// Vue components: `@type32/codemirror-rich-obsidian-editor/vue`. Needs Vue and Nuxt UI (its Vite plugin and `app.use(ui)`).
// The editor's API (facets, commands, types) is the root entry; the overlay toolkit is `/kit`, the extensions `/ext`.
export { default as Editor } from '../components/Editor.client.vue'
export { default as CodeEditor } from '../components/CodeEditor.client.vue'
export { default as ImageEmbedComponent } from '../components/Editor/ImageEmbedComponent.vue'
export { vueRenderers } from './renderers'
export { mountVueComponent, vueContextFacet } from '../kit/vue'
