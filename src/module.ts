import { defineNuxtModule, addPlugin, createResolver, addComponentsDir, addImportsDir } from '@nuxt/kit'

// Module options TypeScript interface definition
export interface ModuleOptions {
}

export default defineNuxtModule<ModuleOptions>({
	meta: {
		name: '@type32/codemirror-rich-obsidian-editor',
		configKey: 'cmOfmEditor',
	},
	// Default configuration options of the Nuxt module
	defaults: {},
	setup(_options, _nuxt) {
		const resolver = createResolver(import.meta.url)

		// Add dependencies to transpile
		_nuxt.options.build.transpile.push('alfaaz', 'js-yaml')

		_nuxt.options.alias['#codemirror-rich-obsidian-editor'] = resolver.resolve(
			'./runtime/editor/types',
		)

		_nuxt.options.alias['#codemirror-rich-obsidian-editor#css'] = resolver.resolve(
			'./runtime/assets/css',
		)

		_nuxt.options.css.unshift(resolver.resolve('./runtime/assets/css/editor.css'))

		addComponentsDir({
			path: resolver.resolve('./runtime/components')
		})

		addImportsDir(resolver.resolve('./runtime/composables'))
		addImportsDir(resolver.resolve('./runtime/utils'))
	},
})
