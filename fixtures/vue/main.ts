import './main.css'
import 'katex/dist/katex.min.css'
import '@type32/codemirror-rich-obsidian-editor/tailwind.css'
import { createApp } from 'vue'
import ui from '@nuxt/ui/vue-plugin'
import App from './App.vue'

createApp(App).use(ui).mount('#app')
