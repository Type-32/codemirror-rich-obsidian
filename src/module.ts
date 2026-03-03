import { defineNuxtModule, addPlugin, createResolver, addComponentsDir, addImportsDir } from '@nuxt/kit'

// Module options TypeScript interface definition
export interface ModuleOptions {
}

export default defineNuxtModule<ModuleOptions>({
	meta: {
		name: '@type32/codemirror-rich-obsidian-editor',
		configKey: 'cmOfmEditor',
	},
	moduleDependencies: {
		'@nuxt/ui': {
			version: '>=4.4.0'
		}
	},
	setup(_options, _nuxt) {
		const resolver = createResolver(import.meta.url)

		addComponentsDir({
			path: resolver.resolve('runtime/components')
		})

		addImportsDir(resolver.resolve('runtime/composables'))
		addImportsDir(resolver.resolve('runtime/utils'))

		_nuxt.options.build.transpile.push(
			'alfaaz',
			'js-yaml',
			'lezer-markdown-obsidian',
			'markdown-it-obsidian-callouts',
		)

		// Ensure there is only ever one instance of these singleton packages
		// in the host project by forcing deduplication through Vite's resolve.dedupe.
		const codemirrorPackages = [
			'@codemirror/state',
			'@codemirror/view',
			'@codemirror/language',
			'@codemirror/autocomplete',
			'@codemirror/commands',
			'@codemirror/lang-markdown',
			'@codemirror/lang-json',
			'@codemirror/lang-yaml',
			'@codemirror/language-data',
			'@codemirror/search',
			'@codemirror/lint',
			'@lezer/common',
			'@lezer/highlight',
			'@lezer/markdown',
			'codemirror',
			'vue-codemirror6',
		]

		_nuxt.hook('vite:extendConfig', (config) => {
			config.resolve ??= {}
			config.resolve.dedupe ??= []
			config.resolve.dedupe.push(...codemirrorPackages)

			config.optimizeDeps ??= {}
			config.optimizeDeps.include ??= []
			config.optimizeDeps.exclude ??= []
			config.optimizeDeps.exclude.push(...codemirrorPackages)
		})

		_nuxt.options.alias['#codemirror-rich-obsidian-editor'] = resolver.resolve(
			'./runtime/editor/types',
		)

		_nuxt.options.alias['#codemirror-rich-obsidian-editor#css'] = resolver.resolve(
			'./runtime/assets/css',
		)

		_nuxt.options.css.unshift(resolver.resolve('./runtime/assets/css/editor.css'))
	},
})
