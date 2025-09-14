import {EditorView} from "@codemirror/view";
import {syntaxTree} from "@codemirror/language";
import {internalLinkMapFacet} from "../linkMappingConfig";
import type {ExternalLinkClickDetail, InternalLinkClickDetail} from "../../types/editor-types";

export const editorLinkClickPlugin = EditorView.domEventHandlers({
    mousedown(event, view) {
        let target = event.target as HTMLElement;

        const imageEmbed = target.closest('.internal-embed');
        if (imageEmbed) {
            const posData = (imageEmbed as HTMLElement).dataset;
            if (posData.embedPos) {
                const from = posData.selectionFrom ? parseInt(posData.selectionFrom, 10) : parseInt(posData.embedPos, 10);
                const to = posData.selectionTo ? parseInt(posData.selectionTo, 10) : syntaxTree(view.state).resolve(from, -1).to;

                view.dispatch({
                    selection: { anchor: from, head: to }
                });
                return true;
            }
        }

        const anchor = target.closest('a.cm-link') as HTMLAnchorElement;

        if (!anchor) {
            return false;
        }

        if (anchor.dataset.internalLink === 'true') {
            event.preventDefault();

            const path = anchor.dataset.path;
            if (!path) return true;

            const linkMap = view.state.facet(internalLinkMapFacet);
            const linkInfo = linkMap.find(l => l.internalLinkName === path);
            const type = anchor.dataset.type as 'embed' | 'internal-link' | undefined;

            const detail: InternalLinkClickDetail = {
                path: path,
                subpath: anchor.dataset.subpath,
                display: anchor.dataset.display,
                type: type || 'internal-link',
                redirectToPath: linkInfo?.redirectToPath,
            }

            view.dom.dispatchEvent(new CustomEvent('internal-link-click', {
                bubbles: true,
                composed: true,
                detail: detail,
            }));
        } else if (anchor.dataset.externalLink === 'true') {
            event.preventDefault();
            const url = anchor.dataset.url;
            if (url) {
                const detail: ExternalLinkClickDetail = {
                    url: url,
                    text: anchor.textContent,
                }
                view.dom.dispatchEvent(new CustomEvent('external-link-click', {
                    bubbles: true,
                    composed: true,
                    detail: detail,
                }));
            }
        }

        return true;
    },
});