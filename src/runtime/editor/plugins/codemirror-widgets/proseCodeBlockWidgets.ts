import { WidgetType } from '@codemirror/view';
import type { EditorView } from '@codemirror/view';

const COPY_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>'

/**
 * Replaces the opening fence of a rendered code block: the language's display name (`js` → JavaScript), the raw
 * info for unknown languages, or a copy icon without one. Clicking copies the code.
 */
export class LanguageFlairWidget extends WidgetType {
    private button: HTMLButtonElement | null = null;

    constructor(readonly label: string, readonly codeContent: string) {
        super();
    }

    toDOM(_view: EditorView): HTMLElement {
        const widgetRoot = document.createElement('div');
        widgetRoot.className = 'cm-codeblock-flair-container';
        widgetRoot.setAttribute('contenteditable', 'false');

        this.button = document.createElement('button');
        this.button.className = 'cm-codeblock-copy-button';
        this.button.setAttribute('aria-label', 'Copy');
        if (this.label) this.button.textContent = this.label;
        else this.button.innerHTML = COPY_ICON;
        this.button.onclick = (event) => {
            event.stopPropagation();
            navigator.clipboard.writeText(this.codeContent)
                .then(() => {
                    if (!this.button) return;
                    this.button.disabled = true;
                    setTimeout(() => {
                        if (this.button) this.button.disabled = false;
                    }, 1500);
                })
                .catch(err => console.error('Failed to copy code to clipboard:', err));
        };
        widgetRoot.appendChild(this.button);
        return widgetRoot;
    }

    override eq(other: LanguageFlairWidget): boolean {
        return other.label === this.label && other.codeContent === this.codeContent;
    }

    override ignoreEvent(event: Event): boolean {
        // The button handles its own clicks; elsewhere on the flair line, CodeMirror places the cursor (revealing the fences).
        return (event.type === 'mousedown' || event.type === 'click') && !!this.button?.contains(event.target as Node);
    }
}

/** Replaces the closing fence of a rendered code block with nothing (the line stays as the block's bottom padding). */
export class EndFenceWidget extends WidgetType {
    toDOM(): HTMLElement {
        const div = document.createElement('div');
        div.className = 'hidden';
        return div;
    }

    override ignoreEvent(): boolean {
        return true;
    }
}
