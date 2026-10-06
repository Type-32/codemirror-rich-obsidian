import { Facet } from '@codemirror/state'
import type { App } from 'vue'

/**
 * The host Vue app, so widgets that render Vue components can share its context
 * (Nuxt UI app config, portal targets, auto-registered components, icons).
 */
export const hostAppFacet = Facet.define<App | null, App | null>({
    combine: values => values[0] ?? null,
})
