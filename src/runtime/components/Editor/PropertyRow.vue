<script setup lang="ts">
import { computed, inject, nextTick, ref } from 'vue'
import type { DropdownMenuItem } from '@nuxt/ui'
import type { PropertyType } from '../../editor/types/editor-types'
import { isListType } from '../../editor/utility/properties'
import { MENU_UI, PROPERTIES, SUGGESTIONS_CONTENT, TYPE_ICONS, TYPE_LABELS, pathId, wikilink } from './properties'

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
const draft = ref('')
const input = ref<{ inputRef: HTMLInputElement | null }>()
const inputType = computed(() => ({ number: 'number', date: 'date', datetime: 'datetime-local' } as Record<string, string>)[type.value] ?? 'text')
const empty = computed(() => props.value === null || props.value === undefined || props.value === '')
const link = computed(() => wikilink(props.value))

async function edit() {
    if (!api.editable || editing.value) return
    draft.value = empty.value ? '' : String(props.value)
    editing.value = true
    await nextTick()
    input.value?.inputRef?.focus()
    input.value?.inputRef?.select()
}

function commit(stay: boolean) {
    if (!editing.value) return
    editing.value = false
    const raw = draft.value
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
const pillDraft = ref('')

function addPill() {
    const item = pillDraft.value.trim().replace(type.value === 'tags' ? /^#/ : /^$/, '')
    pillDraft.value = ''
    if (item && !list.value.includes(item)) api.setValue(props.path, [...list.value, item])
}

function removePill(i: number) {
    api.setValue(props.path, list.value.filter((_, j) => j !== i))
}

function onPillBackspace() {
    if (!pillDraft.value && list.value.length) removePill(list.value.length - 1)
}

// Value suggestions (the host's `valueSuggestions`) for text and list values, matching what's typed; the menu
// shows only while some match. Picking one (Enter or click) adds it to a list, or sets and saves a text value.
const menuOpen = ref(false)
const valueItems = computed(() => {
    const listy = isListType(type.value)
    const typed = (listy ? pillDraft.value : draft.value).trim().toLowerCase()
    return api.valueSuggestions(key.value)
        .filter(s => !list.value.includes(s) && s.toLowerCase().includes(typed))
        // The menu writes the picked text into the input after `onSelect`: clear it again once it has.
        .map(s => ({ label: s, onSelect: () => listy ? (pillDraft.value = s, addPill(), nextTick(() => (pillDraft.value = ''))) : (draft.value = s, commit(true)) }))
})
const menuShown = computed(() => menuOpen.value && valueItems.value.length > 0)

/** Enter or Escape in a suggesting input: the menu acts first (Enter applies the highlighted suggestion, which
 *  may happen after this handler; Escape closes it), then the input. */
function onSuggestKey(e: KeyboardEvent, then: () => void) {
    if (e.key === 'Escape') {
        if (menuShown.value) return
        e.preventDefault()
        e.stopPropagation()
        then()
    }
    else {
        e.stopPropagation()
        nextTick(then)
    }
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
        <UDropdownMenu :items="menu" :size="api.menuSize()" :disabled="!api.editable" :content="{ align: 'start' }" :ui="{ content: MENU_UI }">
            <UButton
                :icon="TYPE_ICONS[type]" size="sm" color="neutral" variant="ghost" square class="cm-property-icon" tabindex="-1"
                :aria-label="api.t('ui.properties.type', 'Property type')"
            />
        </UDropdownMenu>
        <UInput
            :model-value="key"
            size="sm" variant="none" class="cm-property-key" :ui="{ base: 'px-0 text-muted' }"
            :readonly="!api.editable"
            autocapitalize="none"
            @change="rename"
            @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
            @keydown.esc.prevent.stop="restoreName"
        />
        <div class="cm-property-value">
            <UCheckbox
                v-if="type === 'checkbox'"
                :model-value="!!value"
                :disabled="!api.editable"
                class="cm-property-checkbox" :ui="{ base: 'cm-property-edit' }"
                @update:model-value="api.setValue(path, !!$event)"
            />
            <div v-else-if="isListType(type)" class="cm-property-pills">
                <UBadge v-for="(item, i) in list" :key="`${i}:${item}`" color="neutral" variant="subtle" size="sm" class="cm-property-pill">
                    <ULink v-if="wikilink(item)" raw class="cm-property-link" @click.prevent="api.openLink(wikilink(item)!.target, wikilink(item)!.text)">{{ wikilink(item)!.text }}</ULink>
                    <span v-else>{{ item }}</span>
                    <template v-if="api.editable" #trailing>
                        <UButton
                            icon="i-lucide-x" size="xs" color="neutral" variant="link" class="cm-property-pill-remove p-0" tabindex="-1"
                            :aria-label="api.t('ui.properties.remove', 'Remove')"
                            @click="removePill(i)"
                        />
                    </template>
                </UBadge>
                <UInputMenu
                    v-if="api.editable"
                    v-model="pillDraft"
                    mode="autocomplete"
                    :items="valueItems"
                    value-key="label"
                    :content="SUGGESTIONS_CONTENT"
                    ignore-filter
                    open-on-focus
                    :open="menuShown"
                    size="sm" variant="none" class="cm-property-pill-input" :ui="{ base: 'px-0 cm-property-edit', trailing: 'hidden', content: MENU_UI }"
                    autocapitalize="none"
                    @update:open="menuOpen = $event"
                    @keydown.enter="onSuggestKey($event, addPill)"
                    @keydown.esc="onSuggestKey($event, () => api.focusRow(path))"
                    @keydown.backspace="onPillBackspace"
                    @focusout="addPill"
                />
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
            <UInputMenu
                v-else-if="editing && type === 'text'"
                ref="input"
                v-model="draft"
                mode="autocomplete"
                :items="valueItems"
                value-key="label"
                :content="SUGGESTIONS_CONTENT"
                ignore-filter
                open-on-focus
                :open="menuShown"
                size="sm" variant="none" class="cm-property-input" :ui="{ base: 'px-0', trailing: 'hidden', content: MENU_UI }"
                @update:open="menuOpen = $event"
                @keydown.enter="onSuggestKey($event, () => commit(true))"
                @keydown.esc="onSuggestKey($event, cancel)"
                @focusout="commit(false)"
            />
            <UInput
                v-else-if="editing"
                ref="input"
                v-model="draft"
                size="sm" variant="none" class="cm-property-input" :ui="{ base: 'px-0' }"
                :type="inputType"
                @keydown.enter.prevent.stop="commit(true)"
                @keydown.esc.prevent.stop="cancel"
                @blur="commit(false)"
            />
            <div v-else class="cm-property-display cm-property-edit" @click="edit">
                <ULink v-if="link" raw class="cm-property-link" @click.stop.prevent="api.openLink(link.target, link.text)">{{ link.text }}</ULink>
                <span v-else-if="empty" class="cm-property-empty">{{ api.t('ui.properties.empty', 'Empty') }}</span>
                <span v-else>{{ value }}</span>
            </div>
        </div>
    </div>
</template>
