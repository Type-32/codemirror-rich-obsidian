<script setup lang="ts">
import { computed, inject, nextTick, ref } from 'vue'
import type { DropdownMenuItem } from '@nuxt/ui'
import type { PropertyType } from '../../editor/types/editor-types'
import { isListType } from '../../editor/utility/properties'
import { PROPERTIES, TYPE_ICONS, TYPE_LABELS, pathId, wikilink } from './properties'

defineOptions({ name: 'PropertyRow' })

/** One property: type icon (menu), name (rename in place), and an editor for its value. Objects nest rows. */
const props = defineProps<{ path: string[], value: unknown }>()
const api = inject(PROPERTIES)!
const key = computed(() => props.path.at(-1)!)
const type = computed(() => api.typeOf(props.path, props.value))
const row = ref<HTMLElement>()

const TYPES: PropertyType[] = ['text', 'list', 'number', 'checkbox', 'date', 'datetime', 'tags', 'aliases', 'object']
const menu = computed<DropdownMenuItem[][]>(() => [
    [
        { type: 'label', label: api.t('ui.properties.type', 'Property type') },
        ...TYPES.map(ty => ({
            label: api.t(`ui.properties.type.${ty}`, TYPE_LABELS[ty]), icon: TYPE_ICONS[ty], type: 'checkbox' as const,
            checked: ty === type.value, onSelect: () => api.setType(props.path, ty, props.value),
        })),
    ],
    [{ label: api.t('ui.properties.remove', 'Remove'), icon: 'i-lucide-trash-2', color: 'error', onSelect: () => api.remove(props.path) }],
])

// Name: renamed on change (Enter or blur); Escape restores it.
function rename(e: Event) {
    const input = e.target as HTMLInputElement
    const name = input.value.trim()
    if (name === key.value) return
    if (api.rename(props.path, name)) api.focusRow([...props.path.slice(0, -1), name])
    else input.value = key.value
}

function restoreName(e: Event) {
    (e.target as HTMLInputElement).value = key.value
    row.value?.focus()
}

// Scalar values (text, number, date, date & time): shown rendered, edited in an input with the text selected.
const editing = ref(false)
const input = ref<HTMLInputElement>()
const inputType = computed(() => ({ number: 'number', date: 'date', datetime: 'datetime-local' } as Record<string, string>)[type.value] ?? 'text')
const empty = computed(() => props.value === null || props.value === undefined || props.value === '')
const link = computed(() => wikilink(props.value))

async function edit() {
    if (!api.editable || editing.value) return
    editing.value = true
    await nextTick()
    input.value?.focus()
    input.value?.select()
}

function commit(stay: boolean) {
    if (!editing.value) return
    editing.value = false
    const raw = input.value!.value
    const next = raw === '' ? null : type.value === 'number' ? Number(raw) : raw
    if (next !== (props.value ?? null)) api.setValue(props.path, next)
    if (stay) api.focusRow(props.path)
}

function cancel() {
    editing.value = false
    api.focusRow(props.path)
}

// Lists (list, tags, aliases): pills plus an input; Enter or blur adds, Backspace on an empty input removes the last.
const list = computed(() => (Array.isArray(props.value) ? props.value.map(String) : empty.value ? [] : [String(props.value)]))
const listId = computed(() => `cm-property-values-${pathId(props.path)}`)
const suggestions = computed(() => api.valueSuggestions(key.value).filter(s => !list.value.includes(s)))

function addPill(e: Event) {
    const el = e.target as HTMLInputElement
    const item = el.value.trim().replace(type.value === 'tags' ? /^#/ : /^$/, '')
    el.value = ''
    if (item && !list.value.includes(item)) api.setValue(props.path, [...list.value, item])
}

function removePill(i: number) {
    api.setValue(props.path, list.value.filter((_, j) => j !== i))
}

function onPillBackspace(e: KeyboardEvent) {
    if (!(e.target as HTMLInputElement).value && list.value.length) removePill(list.value.length - 1)
}

// Objects: child rows, plus adding a field (named `key`, `key1`, … to rename).
function addField() {
    const taken = Object.keys(props.value as object)
    let name = 'key'
    for (let i = 1; taken.includes(name); i++) name = `key${i}`
    api.setValue([...props.path, name], null)
    api.focusRow([...props.path, name])
}
</script>

<template>
    <div
        ref="row"
        class="cm-property"
        tabindex="0"
        :data-property-path="pathId(path)"
        :data-property-key="key"
        :data-property-type="type"
    >
        <UDropdownMenu :items="menu" :disabled="!api.editable" :content="{ align: 'start' }">
            <button type="button" class="cm-property-icon" tabindex="-1" :aria-label="api.t('ui.properties.type', 'Property type')">
                <UIcon :name="TYPE_ICONS[type]" />
            </button>
        </UDropdownMenu>
        <input
            class="cm-property-key"
            :value="key"
            :readonly="!api.editable"
            autocapitalize="none"
            @change="rename"
            @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
            @keydown.esc.prevent.stop="restoreName"
        >
        <div class="cm-property-value">
            <input
                v-if="type === 'checkbox'"
                type="checkbox"
                class="cm-property-checkbox cm-property-edit"
                :checked="!!value"
                :disabled="!api.editable"
                @change="api.setValue(path, ($event.target as HTMLInputElement).checked)"
            >
            <div v-else-if="isListType(type)" class="cm-property-pills">
                <span v-for="(item, i) in list" :key="`${i}:${item}`" class="cm-property-pill">
                    <a v-if="wikilink(item)" class="cm-property-link" @click.prevent="api.openLink(wikilink(item)!.target, wikilink(item)!.text)">{{ wikilink(item)!.text }}</a>
                    <span v-else>{{ item }}</span>
                    <button v-if="api.editable" type="button" class="cm-property-pill-remove" tabindex="-1" :aria-label="api.t('ui.properties.remove', 'Remove')" @click="removePill(i)">
                        <UIcon name="i-lucide-x" />
                    </button>
                </span>
                <input
                    v-if="api.editable"
                    class="cm-property-pill-input cm-property-edit"
                    :list="listId"
                    autocapitalize="none"
                    @keydown.enter.prevent="addPill"
                    @keydown.backspace="onPillBackspace"
                    @keydown.esc.prevent.stop="api.focusRow(path)"
                    @blur="addPill"
                >
                <datalist :id="listId">
                    <option v-for="s in suggestions" :key="s" :value="s" />
                </datalist>
            </div>
            <div v-else-if="type === 'object'" class="cm-property-children">
                <PropertyRow v-for="(child, k) in (value as Record<string, unknown>)" :key="k" :path="[...path, String(k)]" :value="child" />
                <UButton
                    v-if="api.editable" size="sm" color="neutral" variant="ghost" icon="i-lucide-plus" class="cm-property-add-field" tabindex="-1"
                    :label="api.t('ui.properties.addField', 'Add field')"
                    @click="addField"
                />
            </div>
            <span v-else-if="type === 'unknown'" class="cm-property-unknown">{{ JSON.stringify(value) }}</span>
            <input
                v-else-if="editing"
                ref="input"
                class="cm-property-input"
                :type="inputType"
                :value="value ?? ''"
                @keydown.enter.prevent.stop="commit(true)"
                @keydown.esc.prevent.stop="cancel"
                @blur="commit(false)"
            >
            <div v-else class="cm-property-display cm-property-edit" @click="edit">
                <a v-if="link" class="cm-property-link" @click.stop.prevent="api.openLink(link.target, link.text)">{{ link.text }}</a>
                <span v-else-if="empty" class="cm-property-empty">{{ api.t('ui.properties.empty', 'Empty') }}</span>
                <span v-else>{{ value }}</span>
            </div>
        </div>
    </div>
</template>
