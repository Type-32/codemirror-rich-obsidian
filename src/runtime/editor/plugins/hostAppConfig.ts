import { Facet } from '@codemirror/state'

/** Nuxt UI sizes. */
export type MenuSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

/** Size of the menus the editor's components open (`<Editor :context-menu-size>`); unset is Nuxt UI's default (`md`). */
export const contextMenuSize = Facet.define<MenuSize | undefined, MenuSize | undefined>({
    combine: values => values[0],
})
