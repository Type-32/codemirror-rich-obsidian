import { defineNuxtModule, createResolver, addComponentsDir, addImportsDir, addServerHandler, addServerImports, extendViteConfig, tryResolveModule, directoryToURL, useLogger } from '@nuxt/kit'

export interface ModuleOptions {
	/**
	 * OpenAI-compatible endpoint the server calls for `aiAssistant()` (via `POST /api/_cm-editor/ai`)
	 * and `useEditorAiModel()`. Each field can be overridden at runtime with
	 * `NUXT_CM_OFM_EDITOR_AI_BASE_URL`, `_MODEL`, `_API_KEY`. The key never reaches the browser.
	 */
	ai?: {
		/** e.g. `http://localhost:11434/v1` (Ollama), `https://openrouter.ai/api/v1`, `https://api.openai.com/v1`. */
		baseURL?: string
		model?: string
		apiKey?: string
		headers?: Record<string, string>
		/** Serve `POST /api/_cm-editor/ai`. Default `true`; `false` if you serve your own route (then pass `aiAssistant({ api })`). */
		route?: boolean
	}
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
			'lezer-markdown-obsidian',
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
		// `/ext/ai` needs the optional peers `ai`, `@ai-sdk/vue` and `@ai-sdk/openai-compatible`; when the
		// host lacks them it gets a fallback with the same exports that warns at use instead of failing
		// the build. More specific keys first: the alias plugin takes the first prefix match.
		const hostDirs = [_nuxt.options.rootDir, ..._nuxt.options.modulesDir].map(directoryToURL)
		const has = async (id: string) => !!(await tryResolveModule(id, hostDirs))
		const [hasAi, hasAiVue, hasCompat] = await Promise.all([has('ai'), has('@ai-sdk/vue'), has('@ai-sdk/openai-compatible')])
		const pkg = '@type32/codemirror-rich-obsidian-editor'
		_nuxt.options.alias[`${pkg}/ext/ai/tools`] = resolver.resolve(hasAi ? './runtime/ext/ai/tools' : './runtime/ext/ai/tools-unavailable')
		_nuxt.options.alias[`${pkg}/ext/ai`] = resolver.resolve(hasAi && hasAiVue && hasCompat ? './runtime/ext/ai' : './runtime/ext/ai/unavailable')
		_nuxt.options.alias[`${pkg}/kit`] = resolver.resolve('./runtime/kit')
		_nuxt.options.alias[`${pkg}/ext`] = resolver.resolve('./runtime/ext')

		// Server side of the AI assistant: private config, the default route, and `useEditorAiModel()`.
		const ai = _options.ai ?? {}
		_nuxt.options.runtimeConfig.cmOfmEditor = {
			ai: { baseURL: ai.baseURL ?? '', model: ai.model ?? '', apiKey: ai.apiKey ?? '', headers: ai.headers ?? {} },
		}
		const serverAi = hasAi && hasCompat
		addServerImports([{ name: 'useEditorAiModel', from: resolver.resolve(serverAi ? './runtime/server/model' : './runtime/server/model-unavailable') }])
		if (serverAi && ai.route !== false) {
			addServerHandler({ route: '/api/_cm-editor/ai', method: 'post', handler: resolver.resolve('./runtime/server/ai.post') })
		}
		if (!serverAi && _options.ai) {
			useLogger('codemirror-rich-obsidian-editor').warn('`cmOfmEditor.ai` is set, but the AI route is disabled: install the optional peer dependencies `ai` and `@ai-sdk/openai-compatible`.')
		}

		_nuxt.options.css.unshift(resolver.resolve('./runtime/assets/css/editor.css'))
	},
})
