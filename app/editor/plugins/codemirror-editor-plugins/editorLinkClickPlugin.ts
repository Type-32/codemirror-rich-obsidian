import {EditorView} from "@codemirror/view";
import {syntaxTree} from "@codemirror/language";

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
            view.dom.dispatchEvent(new CustomEvent('internal-link-click', {
                bubbles: true,
                composed: true,
                detail: {
                    path: anchor.dataset.path,
                    subpath: anchor.dataset.subpath,
                    display: anchor.dataset.display,
                    type: anchor.dataset.type,
                },
            }));
        } else if (anchor.dataset.externalLink === 'true') {
            event.preventDefault();
            const url = anchor.dataset.url;
            if (url) {
                window.open(url, '_blank');
            }
        }

        return true;
    },
});