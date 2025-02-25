import { expect } from 'bun:test';
import * as matchers from '@testing-library/jest-dom/matchers';
import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from 'util';
import { Window } from 'happy-dom';

// Add jest-dom matchers to Bun's expect
Object.assign(expect, matchers);

// Create a new window with happy-dom
const window = new Window();
const document = window.document;

// Create and append body if it doesn't exist
if (!document.body) {
    const body = document.createElement('body');
    document.appendChild(body);
}

// Setup global objects
Object.defineProperty(globalThis, 'window', { value: window });
Object.defineProperty(globalThis, 'document', { value: document });
Object.defineProperty(globalThis, 'navigator', { value: window.navigator });
Object.defineProperty(globalThis, 'DocumentFragment', { value: window.DocumentFragment });
Object.defineProperty(globalThis, 'Element', { value: window.Element });
Object.defineProperty(globalThis, 'HTMLElement', { value: window.HTMLElement });
Object.defineProperty(globalThis, 'HTMLInputElement', { value: window.HTMLInputElement });
Object.defineProperty(globalThis, 'HTMLSelectElement', { value: window.HTMLSelectElement });
Object.defineProperty(globalThis, 'Node', { value: window.Node });
Object.defineProperty(globalThis, 'Event', { value: window.Event });
Object.defineProperty(globalThis, 'getComputedStyle', {
    value: window.getComputedStyle.bind(window),
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => { },
        removeListener: () => { },
        addEventListener: () => { },
        removeEventListener: () => { },
        dispatchEvent: () => false,
    }),
});

// Polyfill for TextEncoder/TextDecoder
global.TextEncoder = NodeTextEncoder as typeof global.TextEncoder;
global.TextDecoder = NodeTextDecoder as typeof global.TextDecoder;

// Mock MutationObserver
class MockMutationObserver implements MutationObserver {
    observe(_target: Node, _options?: MutationObserverInit): void { }
    disconnect(): void { }
    takeRecords(): MutationRecord[] { return [] }
}
global.MutationObserver = MockMutationObserver;

// Mock Element.prototype methods that might be missing
if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => { };
}

// Add ResizeObserver
global.ResizeObserver = class ResizeObserver implements globalThis.ResizeObserver {
    observe(_target: Element): void { }
    unobserve(_target: Element): void { }
    disconnect(): void { }
};

// Add missing focus management APIs
document.hasFocus = () => true;

// Add missing event handling for legacy browsers
interface LegacyElement extends Element {
    attachEvent(event: string, handler: EventListener): void;
    detachEvent(event: string, handler: EventListener): void;
}

(Element.prototype as LegacyElement).attachEvent = function (event: string, handler: EventListener): void {
    this.addEventListener(event.slice(2), handler);
};

(Element.prototype as LegacyElement).detachEvent = function (event: string, handler: EventListener): void {
    this.removeEventListener(event.slice(2), handler);
};

// Ensure pointer events are enabled for testing
document.body.style.pointerEvents = 'auto';

// Export test utilities
export { expect }; 