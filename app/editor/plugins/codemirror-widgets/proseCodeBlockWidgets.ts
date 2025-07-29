import { WidgetType } from '@codemirror/view';
import type { EditorView } from '@codemirror/view';

// Widget for the language flair on the first line
export class LanguageFlairWidget extends WidgetType {
    private button: HTMLButtonElement | null = null;

    constructor(private lang: string, private codeContent: string) {
        super();
    }

    toDOM(view: EditorView): HTMLElement {
        const widgetRoot = document.createElement('div');
        widgetRoot.className = 'cm-codeblock-flair-container'; // For styling the line's new content
        widgetRoot.setAttribute('contenteditable', 'false');

        // You could add a copy button here as another child of widgetRoot
        this.button = document.createElement('button');
        this.button.className = 'cm-codeblock-copy-button';
        this.button.textContent = this.lang || '';
        this.button.onclick = (event) => {
            event.stopPropagation();
            navigator.clipboard.writeText(this.codeContent)
                .then(() => {
                    if (this.button) {
                        this.button.disabled = true;
                        setTimeout(() => {
                            if (this.button) {
                                this.button.disabled = false;
                            }
                        }, 1500); // Revert after 1.5 seconds
                    }
                })
                .catch(err => {
                    console.error('Failed to copy code to clipboard:', err);
                    // Optional: Notify user of error
                });
        };
        widgetRoot.appendChild(this.button);

        return widgetRoot;
    }

    override eq(other: LanguageFlairWidget): boolean {
        return other.lang === this.lang && other.codeContent === this.codeContent;
    }

    override ignoreEvent(event: Event): boolean {
        // If mousedown/click is on the button, we handle it (return true, CM ignores).
        if ((event.type === 'mousedown' || event.type === 'click') && this.button && this.button.contains(event.target as Node)) {
            return true;
        }
        // For other events on the widget, or clicks not on the button, let CodeMirror handle them.
        // This allows clicking on the flair text (not the button) to potentially give focus
        // to the line, which then causes our plugin to hide the widget and show source.
        return false;
    }
}

// Widget for the closing fence line
export class EndFenceWidget extends WidgetType {
    toDOM(view: EditorView): HTMLElement {
        const div = document.createElement('div');
        div.className = 'hidden'; // Style for padding or specific look
        // div.setAttribute('contenteditable', 'false');
        // // This widget replaces '```'. It can be an empty styled div.
        // // Example: ensure it has some height if it's an empty line.
        // div.innerHTML = '&nbsp;'; // Or style with min-height
        return div;
    }

    override ignoreEvent(): boolean {
        return true;
    }
}