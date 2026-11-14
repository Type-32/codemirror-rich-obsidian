import { EditorState, Facet, type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { internalLinkMapFacet } from '../plugins/linkMappingConfig'
import { specialCodeBlockMapFacet } from '../plugins/specialCodeBlockMappingConfig'
import { vueContextFacet } from '../plugins/hostAppConfig'
import { editorLabels } from '../../kit/labels'

/**
 * The extensions nested editors render with. `wysiwyg()` provides itself here, so widgets can render markdown
 * exactly like the editor that contains them without importing it (which would be an import cycle).
 */
export const nestedEditorContent = Facet.define<() => Extension, (() => Extension) | null>({ combine: values => values[0] ?? null })

/** What makes a nested editor read-only; the default `nestedEditor` mode. */
export const readOnly: Extension = [EditorState.readOnly.of(true), EditorView.editable.of(false)]

/**
 * An editor rendering `doc` the way `parent` renders markdown (same live preview, link and code-block mappings, Vue
 * context, labels), mounted in `container`; destroy it with the widget. Read-only by default (callout titles and
 * bodies), so nothing in it reveals source; `extensions` replaces that, e.g. with a compartment that makes a table
 * cell editable while it's being edited.
 */
export function nestedEditor(parent: EditorView, doc: string, container: HTMLElement, extensions: Extension = readOnly): EditorView {
    const content = parent.state.facet(nestedEditorContent)
    return new EditorView({
        parent: container,
        state: EditorState.create({
            doc,
            extensions: [
                content ? content() : [],
                internalLinkMapFacet.of(parent.state.facet(internalLinkMapFacet)),
                specialCodeBlockMapFacet.of(parent.state.facet(specialCodeBlockMapFacet)),
                vueContextFacet.of(parent.state.facet(vueContextFacet)),
                editorLabels.of(parent.state.facet(editorLabels)),
                EditorState.tabSize.of(parent.state.tabSize),
                extensions,
                EditorView.lineWrapping,
                // The parent measures widget heights; tell it when this one changes (images loading, folds).
                EditorView.updateListener.of((u) => {
                    if (u.heightChanged || u.geometryChanged) parent.requestMeasure()
                }),
            ],
        }),
    })
}
