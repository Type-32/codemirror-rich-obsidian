<script setup lang="ts">
// Collaboration check: two editors, each on its own Y.Doc, synced in-page (no server), set up as a host would.
import * as Y from 'yjs'
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness'
import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next'
import { keymap } from '@codemirror/view'
import { Prec, Transaction } from '@codemirror/state'
import { bodyLineAfter, listRenumbering } from '@type32/codemirror-rich-obsidian-editor'
import { slashMenu } from '@type32/codemirror-rich-obsidian-editor/ext'

const SEED = `---
status: draft
tags:
  - lab
---
# Collab

1. one
2. two
3. three

| a | b |
| - | - |
| c | d |

> [!note] Title
> Body of the callout

End
`

const connected = ref(true)
// Fixed per page load (`?yundo=1`): rebuilding `yCollab` keeps CodeMirror's old sync plugin on the old config.
const yUndo = useRoute().query.yundo === '1'

function peer(name: 'A' | 'B', color: string) {
	const doc = new Y.Doc()
	const text = doc.getText('note')
	const awareness = new Awareness(doc)
	awareness.setLocalStateField('user', { name, color, colorLight: `${color}33` })
	return { name, doc, text, awareness, undo: new Y.UndoManager(text), model: ref('') }
}
const A = peer('A', '#30a46c'), B = peer('B', '#e5484d')
const peers = [A, B]
A.text.insert(0, SEED)

// Relay: while connected, every update goes to the other doc; reconnecting exchanges what each missed.
for (const [from, to] of [[A, B], [B, A]] as const) {
	from.doc.on('update', (u: Uint8Array, origin: unknown) => {
		if (connected.value && origin !== 'relay') Y.applyUpdate(to.doc, u, 'relay')
	})
	from.awareness.on('update', ({ added, updated, removed }: { added: number[], updated: number[], removed: number[] }) => {
		if (connected.value) applyAwarenessUpdate(to.awareness, encodeAwarenessUpdate(from.awareness, [...added, ...updated, ...removed]), 'relay')
	})
}
Y.applyUpdate(B.doc, Y.encodeStateAsUpdate(A.doc), 'relay')
for (const p of peers) p.model.value = p.text.toString()

watch(connected, (on) => {
	if (!on) return
	Y.applyUpdate(B.doc, Y.encodeStateAsUpdate(A.doc, Y.encodeStateVector(B.doc)), 'relay')
	Y.applyUpdate(A.doc, Y.encodeStateAsUpdate(B.doc, Y.encodeStateVector(A.doc)), 'relay')
})

// Built once per peer: a fresh `yCollab` per render leaves the sync plugin and the undo manager on different configs.
// Peer A is the one that renumbers lists (for its own edits and after B's); B leaves numbering to A.
const extensionsFor = (p: typeof A) => [
	yCollab(p.text, p.awareness, { undoManager: yUndo ? p.undo : false }),
	yUndo ? Prec.highest(keymap.of(yUndoManagerKeymap)) : [],
	listRenumbering.of(p === A ? () => true : false),
	bodyLineAfter.of(tr => !!tr.annotation(Transaction.userEvent)),
	slashMenu(),
]
const extA = extensionsFor(A), extB = extensionsFor(B)
// One array: a new one per render (an inline literal) reconfigures the editor on every keystroke, rebuilding tables.
const links = [{ name: 'My Note', filePath: '/my-note.md', referenceId: 'my-note' }]

const editorA = ref(), editorB = ref()
const same = computed(() => A.model.value === B.model.value)
// For scripted checks from the browser.
if (import.meta.client) Object.assign(window, { __collab: { Y, peers, connected, yUndo, views: () => [editorA.value?.view, editorB.value?.view] } })
</script>

<template>
	<div class="p-6 flex flex-col gap-4">
		<div class="flex items-center gap-6">
			<USwitch v-model="connected" label="Connected" />
			<UBadge color="neutral" variant="outline" :label="yUndo ? 'Undo: Y.UndoManager (?yundo=1)' : 'Undo: CodeMirror history (add ?yundo=1)'" />
			<UBadge :color="same ? 'success' : 'warning'" :label="same ? 'v-models equal' : 'v-models differ'" data-testid="same" />
		</div>
		<div class="grid grid-cols-2 gap-6">
			<div v-for="(p, i) in peers" :key="p.name" class="flex flex-col gap-2">
				<div class="text-sm text-muted">Peer {{ p.name }}</div>
				<Editor v-model="p.model.value" :ref="i ? (e => editorB = e) : (e => editorA = e)" class="w-full" :extensions="i ? extB : extA" :history="!yUndo" :fold-gutter="false" :internal-link-map="links" />
			</div>
		</div>
	</div>
</template>
