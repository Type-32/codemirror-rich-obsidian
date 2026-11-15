import { Facet } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import type { TableModel } from '../../utils/markdownTable'
import type { PropertiesOptions } from '../types/editor-types'
import type { MenuSize } from './hostAppConfig'

/** A rendered surface: told about each new `props` while its widget stays, destroyed with it. */
export interface Mounted<P> {
    update(props: P): void
    destroy(): void
}

/** Draws a widget's surface into `el`. The core editor has no UI of its own for tables and properties; `/vue` supplies them. */
export type Renderer<P> = (view: EditorView, el: HTMLElement, props: P) => Mounted<P>

/** A table the editor renders: its model and markdown, and the size the host wants its menus in. */
export interface RenderedTable {
    model: TableModel
    /** The table's markdown, exactly as in the document. */
    source: string
    /** The editor's `contextMenuSize`. */
    menuSize: MenuSize | undefined
}

/** Everything the properties panel renders from: the YAML, the host's options, the menu size, and whether it can edit. */
export interface PanelState {
    yaml: string
    options: PropertiesOptions
    menuSize: MenuSize | undefined
    editable: boolean
}

const first = <T>(values: readonly T[]) => values[0] ?? null

/** Renders GFM tables. Unset, tables stay markdown. */
export const tableRenderer = Facet.define<Renderer<RenderedTable>, Renderer<RenderedTable> | null>({ combine: first })

/** Renders the properties panel over the frontmatter (`propertiesPanel()`). Unset, the frontmatter stays YAML. */
export const propertiesRenderer = Facet.define<Renderer<PanelState>, Renderer<PanelState> | null>({ combine: first })

/**
 * Mounts a host component (an `InternalLink`'s `embedComponent`, a `SpecialCodeBlockMapping`'s `component`) into
 * `el` with `props`; returns its disposer. `/vue` mounts Vue components. Unset, only `mount` functions render.
 */
export type ComponentMounter = (view: EditorView, el: HTMLElement, component: unknown, props: Record<string, unknown>) => () => void

export const componentMounter = Facet.define<ComponentMounter, ComponentMounter | null>({ combine: first })
