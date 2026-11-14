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

/**
 * A read-only editor rendering `doc` the way `parent` renders markdown (same live preview, link and code-block
 * mappings, Vue context, labels), mounted in `container`. Used for content rendered inside widgets, such as callout
 * titles and bodies; since it isn't editable, nothing in it ever reveals source. Destroy it with the widget.
 */
export function nestedEditor(parent: EditorView, doc: string, container: HTMLElement): EditorView {
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
                EditorState.readOnly.of(true),
                EditorView.editable.of(false),
                EditorView.lineWrapping,
                // The parent measures widget heights; tell it when this one changes (images loading, folds).
                EditorView.updateListener.of((u) => {
                    if (u.heightChanged || u.geometryChanged) parent.requestMeasure()
                }),
            ],
        }),
    })
}
