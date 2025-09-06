// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	devtools: { enabled: true },

	modules: [
		'@nuxt/ui',
		'@nuxt/image',
		'@nuxt/fonts',
		'@nuxt/icon',
		'../src/module',
	],

	css: ['~/assets/css/main.css'],

	compatibilityDate: '2025-09-04',

})
