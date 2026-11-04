import { defineNuxtModule, addPlugin, createResolver, addComponentsDir, addImportsDir, extendViteConfig, tryResolveModule, directoryToURL } from '@nuxt/kit'

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
	async setup(_options, _nuxt) {
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
			// /kit and /ext ship `.vue` files that rely on Nuxt auto-imports (UButton, …).
			resolver.resolve('./runtime'),
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
			'@codemirror/language-data',
			'@codemirror/search',
			'@codemirror/lint',
			'@lezer/common',
			'@lezer/highlight',
			'@lezer/markdown',
			'codemirror',
			'vue-codemirror6',
		]

		extendViteConfig((config) => {
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

		// Pin the public subpaths to this module's runtime, so the stub build (src) and the published
		// build (dist) both load the same facet/field instances as Editor.client.vue.
		// `/ext/ai` needs the optional peers `ai` + `@ai-sdk/vue`; when the host lacks them it gets a
		// fallback with the same exports that warns at use instead of failing the build.
		// More specific keys first: the alias plugin takes the first prefix match.
		const hostDirs = [_nuxt.options.rootDir, ..._nuxt.options.modulesDir].map(directoryToURL)
		const has = async (id: string) => !!(await tryResolveModule(id, hostDirs))
		const [hasAi, hasAiVue] = await Promise.all([has('ai'), has('@ai-sdk/vue')])
		const pkg = '@type32/codemirror-rich-obsidian-editor'
		_nuxt.options.alias[`${pkg}/ext/ai/tools`] = resolver.resolve(hasAi ? './runtime/ext/ai/tools' : './runtime/ext/ai/tools-unavailable')
		_nuxt.options.alias[`${pkg}/ext/ai`] = resolver.resolve(hasAi && hasAiVue ? './runtime/ext/ai' : './runtime/ext/ai/unavailable')
		_nuxt.options.alias[`${pkg}/kit`] = resolver.resolve('./runtime/kit')
		_nuxt.options.alias[`${pkg}/ext`] = resolver.resolve('./runtime/ext')

		_nuxt.options.css.unshift(resolver.resolve('./runtime/assets/css/editor.css'))
	},
})
