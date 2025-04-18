import { JSDOM } from 'jsdom';

// Setup global DOM environment for React Testing Library
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
});

// Set up global objects
global.document = dom.window.document;
global.window = dom.window as unknown as Window & typeof globalThis;
global.navigator = dom.window.navigator;
global.location = dom.window.location;

// Mock browser globals
global.HTMLElement = dom.window.HTMLElement;
global.HTMLInputElement = dom.window.HTMLInputElement;
global.DocumentFragment = dom.window.DocumentFragment;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.NodeList = dom.window.NodeList;
global.MouseEvent = dom.window.MouseEvent;
global.Event = dom.window.Event;
global.MutationObserver = dom.window.MutationObserver || class { 
  observe() {}
  disconnect() {}
  takeRecords() { return []; }
};

// Fix for user-event library
global.getSelection = () => dom.window.getSelection();

// Mock window APIs
global.requestAnimationFrame = (callback) => setTimeout(callback, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);

// Mock other window related APIs
global.scrollTo = () => {};
global.matchMedia = () => ({
  matches: false,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
  media: '',
  onchange: null,
});

console.log('JSDOM environment setup complete'); 