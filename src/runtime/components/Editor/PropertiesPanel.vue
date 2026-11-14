<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, type ShallowRef } from 'vue'
import { EditorView } from '@codemirror/view'
import { parseDocument, type Document } from 'yaml'
import type { PropertyType } from '../../editor/types/editor-types'
import { convertValue, editProperties, frontmatterOf, inferType, removeProperty, renameProperty, setProperty } from '../../editor/utility/properties'
import { frontmatterEnd, propertiesOptions } from '../../editor/plugins/propertiesConfig'
import { internalLinkMapFacet } from '../../editor/plugins/linkMappingConfig'
import { label } from '../../kit/labels'
import PropertyRow from './PropertyRow.vue'
import { PROPERTIES, pathId, type PropertiesApi } from './properties'

const props = defineProps<{ view: EditorView, yaml: ShallowRef<string> }>()
const { view } = props
const root = ref<HTMLElement>()
const options = () => view.state.facet(propertiesOptions)
const data = computed(() => (parseDocument(props.yaml.value).toJS() ?? {}) as Record<string, unknown>)
/** Types picked here for keys the host hasn't typed (until it persists them through `onTypeChange`). */
const picked = ref<Record<string, PropertyType>>({})
const t = (key: string, fallback: string) => label(view.state, key, fallback)
const rowEl = (path: string[]) => [...root.value?.querySelectorAll<HTMLElement>('.cm-property') ?? []].find(el => el.dataset.propertyPath === pathId(path))

/** Rewrite the frontmatter with an edited YAML document: one transaction, one undo step. */
function write(edit: (doc: Document) => void) {
    const end = frontmatterEnd(view.state)
    if (end === null) return
    view.dispatch({ changes: { from: 0, to: end, insert: frontmatterOf(editProperties(props.yaml.value, edit)) } })
}

const api: PropertiesApi = {
    editable: view.state.facet(EditorView.editable),
    t,
    typeOf: (path, value) => (path.length === 1 ? options().types?.[path[0]!] ?? picked.value[path[0]!] : undefined) ?? inferType(path.at(-1)!, value),
    setValue: (path, value) => write(d => setProperty(d, path, value)),
    rename: (path, key) => {
        let ok = false
        write((d) => { ok = renameProperty(d, path, key) })
        return ok
    },
    remove: path => write(d => removeProperty(d, path)),
    setType: (path, type, value) => {
        if (path.length === 1) {
            picked.value = { ...picked.value, [path[0]!]: type }
            options().onTypeChange?.(path[0]!, type)
        }
        const converted = convertValue(value, type)
        if (JSON.stringify(converted) !== JSON.stringify(value ?? null)) write(d => setProperty(d, path, converted))
    },
    valueSuggestions: key => options().valueSuggestions?.(key) ?? [],
    openLink: (target, display) => {
        const link = view.state.facet(internalLinkMapFacet).find(l => l.name === target || l.filePath === target)
        view.dom.dispatchEvent(new CustomEvent('internal-link-click', {
            bubbles: true, composed: true,
            detail: { target, display, type: 'internal-link', referenceId: link?.referenceId },
        }))
    },
    focusRow: async (path) => {
        await nextTick()
        rowEl(path)?.focus()
    },
}
provide(PROPERTIES, api)

// Adding a property: a draft row with a key input; the key is written with an empty value, then its value is edited.
const adding = ref(false)
const draftKey = ref('')
const keyInput = ref<HTMLInputElement>()
const keySuggestions = computed(() => (options().keySuggestions ?? []).filter(k => !(k in data.value)))
const focusAdd = () => nextTick(() => root.value?.querySelector<HTMLElement>('.cm-properties-add')?.focus())

async function startAdd() {
    if (!api.editable) return
    adding.value = true
    draftKey.value = ''
    await nextTick()
    keyInput.value?.focus()
}

/** The control editing a row's value: a text/number/date display, a list's pill input, or a checkbox. */
const valueControl = (row: Element | null | undefined) =>
    row?.querySelector<HTMLElement>(':scope > .cm-property-value > .cm-property-edit, :scope > .cm-property-value > .cm-property-pills > .cm-property-edit')

function commitAdd() {
    const key = draftKey.value.trim()
    adding.value = false
    if (!key || key in data.value) return focusAdd()
    write(d => setProperty(d, [key], null))
    // Straight on to its value, as in Obsidian: a display opens its input on click; a list's input takes focus.
    nextTick(() => {
        const control = valueControl(rowEl([key]))
        control?.focus()
        if (control?.classList.contains('cm-property-display')) control.click()
    })
}

function cancelAdd() {
    adding.value = false
    focusAdd()
}

/** Back to the note: cursor at the start of the body. */
function toEditor() {
    const end = frontmatterEnd(view.state)
    view.focus()
    if (end !== null) view.dispatch({ selection: { anchor: Math.min(end + 1, view.state.doc.length) } })
}

/** No properties left: remove the empty frontmatter itself (with its line break), back to a plain note. */
function deleteFrontmatter() {
    const end = frontmatterEnd(view.state)
    if (end === null || !api.editable) return
    view.dispatch({ changes: { from: 0, to: Math.min(end + 1, view.state.doc.length) }, selection: { anchor: 0 } })
    view.focus()
}

/** Row-level keyboard model (Obsidian's): ↑/↓/Tab move between rows, Enter edits, Escape returns to the note. */
function onKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement
    const stops = [...root.value!.querySelectorAll<HTMLElement>('.cm-property, .cm-properties-add')]
    const at = stops.indexOf(target)
    if (at < 0) return // inside an input: the row handles its own keys
    const back = e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)
    if (back || e.key === 'ArrowDown' || e.key === 'Tab') {
        e.preventDefault()
        const next = at + (back ? -1 : 1)
        if (next >= stops.length) toEditor()
        else stops[Math.max(next, 0)]!.focus()
    }
    else if (e.key === 'Escape') {
        e.preventDefault()
        toEditor()
    }
    else if (e.key === 'Enter') {
        e.preventDefault()
        if (target.classList.contains('cm-properties-add')) startAdd()
        else {
            const control = valueControl(target)
            control?.focus()
            control?.click()
        }
    }
}

// The editor measures widget heights; tell it when the panel grows or shrinks.
let observer: ResizeObserver | undefined
onMounted(() => {
    observer = new ResizeObserver(() => view.requestMeasure())
    observer.observe(root.value!)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
    <div ref="root" class="cm-properties" @keydown="onKeydown">
        <PropertyRow v-for="(value, key) in data" :key="key" :path="[String(key)]" :value="value" />
        <div v-if="adding" class="cm-property cm-property-draft">
            <span class="cm-property-icon" />
            <input
                ref="keyInput"
                v-model="draftKey"
                class="cm-property-key"
                list="cm-property-key-suggestions"
                autocapitalize="none"
                :placeholder="t('ui.properties.name', 'Property name')"
                @keydown.enter.prevent.stop="commitAdd"
                @keydown.esc.prevent.stop="cancelAdd"
                @blur="adding && !draftKey.trim() && cancelAdd()"
            >
            <datalist id="cm-property-key-suggestions">
                <option v-for="k in keySuggestions" :key="k" :value="k" />
            </datalist>
        </div>
        <div v-if="api.editable" class="cm-properties-actions">
            <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-plus" class="cm-properties-add" :label="t('ui.properties.add', 'Add property')" @click="startAdd" />
            <UButton
                v-if="!adding && !Object.keys(data).length"
                size="sm" color="neutral" variant="ghost" icon="i-lucide-trash-2" class="cm-properties-delete"
                :label="t('ui.properties.deleteFrontmatter', 'Delete frontmatter')"
                @click="deleteFrontmatter"
            />
        </div>
    </div>
</template>
