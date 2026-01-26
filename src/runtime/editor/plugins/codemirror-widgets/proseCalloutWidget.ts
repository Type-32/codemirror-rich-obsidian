import { WidgetType } from '@codemirror/view';
import type { EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from "@lezer/common";
// @ts-ignore
import MarkdownIt from 'markdown-it';
// @ts-ignore
import markdownItObsidianCallouts from 'markdown-it-obsidian-callouts';

const md = new MarkdownIt({ html: true }).use(markdownItObsidianCallouts);

export class CalloutWidget extends WidgetType {
    constructor(private sourceNodeFrom: number, private sourceNodeTo: number) {
        super();
    }
    
    private findParentBlockquote(node: SyntaxNode | null): SyntaxNode | null {
        let current = node;
        while (current) {
            if (current.name === 'Blockquote') {
                return current;
            }
            current = current.parent;
        }
        return null;
    }

    toDOM(view: EditorView): HTMLElement {
        const state = view.state;
        const calloutNode = syntaxTree(state).resolve(this.sourceNodeFrom, 1);
        const parentBlockquote = this.findParentBlockquote(calloutNode);
        
        let rawContent = '';
        if (parentBlockquote) {
            rawContent = view.state.doc.sliceString(parentBlockquote.from, parentBlockquote.to);
        }

        const renderedHtml = md.render(rawContent);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = renderedHtml;
        
        const calloutEl = tempDiv.querySelector('.callout') as HTMLElement | null;

        if (!calloutEl) {
            const fallback = document.createElement('div');
            fallback.className = `cm-callout-widget callout callout-error`;
            fallback.textContent = "Error rendering callout";
            return fallback
        }
        
        calloutEl.classList.add('cm-callout-widget');
        calloutEl.setAttribute('contenteditable', 'false');

        const editButton = document.createElement('div');
        editButton.className = 'edit-block-button';
        editButton.setAttribute('aria-label', 'Edit this block');
        editButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 16 4-4-4-4"></path><path d="m6 8-4 4 4 4"></path><path d="m14.5 4-5 16"></path></svg>`;
        editButton.onmousedown = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };
        editButton.onclick = (e) => {
            e.stopPropagation();
            const parentBlockquote = this.findParentBlockquote(syntaxTree(view.state).resolve(this.sourceNodeFrom, 1));
            if (parentBlockquote) {
                view.dispatch({ selection: { anchor: parentBlockquote.from } });
                view.focus();
            }
        };
        
        const titleDiv = calloutEl.querySelector('.callout-title');
        if (titleDiv) {
            const foldDiv = calloutEl.querySelector('.callout-fold');
            if (foldDiv) {
                const foldIcon = document.createElement('svg');
                // foldIcon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                // foldIcon.setAttribute('width', '16');
                // foldIcon.setAttribute('height', '16');
                // foldIcon.setAttribute('viewBox', '0 0 24 24');
                // foldIcon.setAttribute('fill', 'none');
                // foldIcon.setAttribute('stroke', 'currentColor');
                // foldIcon.setAttribute('stroke-width', '2');
                // foldIcon.setAttribute('stroke-linecap', 'round');
                // foldIcon.setAttribute('stroke-linejoin', 'round');
                foldIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-left-icon lucide-chevron-left"><path d="m15 18-6-6 6-6"/></svg>`;
                
                foldDiv.appendChild(foldIcon);
            }
            titleDiv.appendChild(editButton);
        } else {
            calloutEl.prepend(editButton);
        }

        return calloutEl;
    }

    override eq(other: CalloutWidget): boolean {
        // Widgets are equal if they reference the same position range
        // This prevents unnecessary re-rendering of markdown-it when the callout hasn't moved
        return other.sourceNodeFrom === this.sourceNodeFrom &&
            other.sourceNodeTo === this.sourceNodeTo;
    }

    override ignoreEvent(event: Event): boolean {
        if ((event.type === "click" || event.type === "mousedown")) {
            const target = event.target as Element;
            if (target.closest('.edit-block-button') || target.closest('.callout-fold')) {
                return true;
            }
        }
        return false;
    }
}
