import { JSDOM } from 'jsdom';

// Setup global DOM environment for React Testing Library
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window as unknown as Window & typeof globalThis;
global.navigator = dom.window.navigator;

// Mock other browser globals as needed
global.HTMLElement = dom.window.HTMLElement;
global.HTMLInputElement = dom.window.HTMLInputElement;

// Fix for user-event library
global.getSelection = () => dom.window.getSelection();

console.log('JSDOM environment setup complete'); 