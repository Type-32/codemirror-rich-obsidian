// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	devtools: { enabled: true },

	modules: [
		'@nuxt/ui',
		'@nuxt/image',
		'@nuxt/fonts',
		'../src/module',
	],

	css: ['~/assets/css/main.css'],

	// The AI assistant's server endpoint (OpenAI-compatible). Local Ollama here; override with
	// NUXT_CM_OFM_EDITOR_AI_BASE_URL / _MODEL / _API_KEY.
	cmOfmEditor: {
		ai: { baseURL: 'http://localhost:11434/v1', model: 'gemma4:latest' },
	},

	compatibilityDate: '2025-09-04',

})
