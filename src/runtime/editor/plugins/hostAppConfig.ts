import { Facet } from '@codemirror/state'
import type { AppContext } from 'vue'

/**
 * Vue context for components CodeMirror renders (widgets, overlays): the host app's context with
 * `provides` taken from the Editor component instance, so mounted components see app-level config
 * (Nuxt UI, icons, auto-registered components) *and* component-level provides from ancestors such
 * as `<UApp>` (TooltipProvider, toaster, portal target).
 */
export const vueContextFacet = Facet.define<AppContext | null, AppContext | null>({
    combine: values => values[0] ?? null,
})

/** Nuxt UI sizes. */
export type MenuSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

/** Size of the menus the editor's components open (`<Editor :context-menu-size>`); unset is Nuxt UI's default (`md`). */
export const contextMenuSize = Facet.define<MenuSize | undefined, MenuSize | undefined>({
    combine: values => values[0],
})
