import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { StateField, type EditorState, type Extension, type Facet, type Range, type Transaction } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNodeRef } from '@lezer/common'
import { mouseSelectingField, selectionTouches } from '../../utility/tools'

export interface ProsePluginConfig {
	/** Node names this plugin decorates. Only these are visited; the rest of the tree is skipped. */
	nodes: string[]
	/**
	 * Emit decorations for one matching node. Return `false` to skip the node's children.
	 * `active` is whether the selection touches the node (source should be shown).
	 */
	decorate: (node: SyntaxNodeRef, state: EditorState, active: boolean, out: Range<Decoration>[]) => boolean | void
	/**
	 * `block` decorations (block widgets / block replace) must come from a StateField, which
	 * cannot see the viewport and so scans the whole doc. Inline decorations use a ViewPlugin
	 * scoped to `visibleRanges` and patch only changed lines on edits. Default: false.
	 */
	block?: boolean
	/** Facets whose value change must trigger a rebuild (e.g. link/codeblock mappings). */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	reconfigureOn?: readonly Facet<any, any>[]
}

function build(cfg: ProsePluginConfig, nodes: Record<string, true>, state: EditorState, from: number, to: number): Range<Decoration>[] {
	const out: Range<Decoration>[] = []
	syntaxTree(state).iterate({
		from, to,
		enter(node) {
			if (!nodes[node.name]) return
			return cfg.decorate(node, state, selectionTouches(state, node.from, node.to), out)
		},
	})
	return out
}

/**
 * Did the selection change which of this plugin's nodes it touches? Cheap enough to run on
 * every caret move: only nodes overlapping old∪new selection are visited.
 */
function crossedNode(nodes: Record<string, true>, tr: Transaction): boolean {
	const before = tr.startState, after = tr.state
	const lo = Math.min(before.selection.main.from, after.selection.main.from)
	const hi = Math.max(before.selection.main.to, after.selection.main.to)
	let crossed = false
	syntaxTree(after).iterate({
		from: lo, to: hi,
		enter(node) {
			if (crossed) return false
			if (!nodes[node.name]) return
			// No doc change on this path, so the node range is valid in both states.
			if (selectionTouches(before, node.from, node.to) !== selectionTouches(after, node.from, node.to)) crossed = true
			return false
		},
	})
	return crossed
}

export function createProsePlugin(cfg: ProsePluginConfig): Extension {
	const nodes: Record<string, true> = Object.fromEntries(cfg.nodes.map(n => [n, true]))
	const facets = cfg.reconfigureOn ?? []
	const facetChanged = (tr: Transaction) => facets.some(f => tr.startState.facet(f) !== tr.state.facet(f))

	if (cfg.block) {
		const full = (state: EditorState) => Decoration.set(build(cfg, nodes, state, 0, state.doc.length), true)
		return StateField.define<DecorationSet>({
			create: full,
			update(value, tr) {
				const dragging = tr.state.field(mouseSelectingField, false)
				const released = tr.startState.field(mouseSelectingField, false) && !dragging
				if (tr.docChanged || tr.reconfigured || released || facetChanged(tr)) return full(tr.state)
				if (dragging) return value
				if (tr.selection && crossedNode(nodes, tr)) return full(tr.state)
				return value
			},
			provide: f => EditorView.decorations.from(f),
		})
	}

	return ViewPlugin.fromClass(class {
		decorations: DecorationSet
		constructor(view: EditorView) {
			this.decorations = this.full(view)
		}
		full(view: EditorView) {
			const out: Range<Decoration>[] = []
			for (const { from, to } of view.visibleRanges) out.push(...build(cfg, nodes, view.state, from, to))
			return Decoration.set(out, true)
		}
		patch(view: EditorView, decos: DecorationSet, from: number, to: number) {
			return decos.update({
				filter: (f, t) => t < from || f > to,
				add: build(cfg, nodes, view.state, from, to),
				sort: true,
			})
		}
		update(u: ViewUpdate) {
			const dragging = u.state.field(mouseSelectingField, false)
			const released = u.startState.field(mouseSelectingField, false) && !dragging
			if (u.viewportChanged || released || u.transactions.some(t => t.reconfigured || facetChanged(t))) {
				this.decorations = this.full(u.view)
				return
			}
			if (u.docChanged) {
				// Map survivors, rebuild only the lines touched by each change plus the lines the
				// selection left and arrived at (so a node revealed by the old cursor re-renders).
				let decos = this.decorations.map(u.changes)
				const doc = u.state.doc
				const lines = (from: number, to: number) => { decos = this.patch(u.view, decos, doc.lineAt(from).from, doc.lineAt(to).to) }
				u.changes.iterChangedRanges((_a, _b, fromB, toB) => lines(fromB, toB))
				const old = u.startState.selection.main
				lines(u.changes.mapPos(old.from), u.changes.mapPos(old.to))
				lines(u.state.selection.main.from, u.state.selection.main.to)
				this.decorations = decos
				return
			}
			if (dragging) return
			if (u.selectionSet && u.transactions.some(t => crossedNode(nodes, t))) this.decorations = this.full(u.view)
		}
	}, { decorations: v => v.decorations })
}
