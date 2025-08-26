import { beforeAll, afterEach } from 'bun:test';
import { cleanup } from '@testing-library/react';

// Setup DOM environment
import '@testing-library/jest-dom';

// Mock global APIs
globalThis.HTMLElement = globalThis.HTMLElement || class {};
globalThis.HTMLButtonElement = globalThis.HTMLButtonElement || class {};
globalThis.HTMLInputElement = globalThis.HTMLInputElement || class {};
globalThis.HTMLDivElement = globalThis.HTMLDivElement || class {};

// Mock Speech Recognition API
const mockSpeechRecognition = {
  start: jest.fn ? jest.fn() : (() => {}),
  stop: jest.fn ? jest.fn() : (() => {}),
  abort: jest.fn ? jest.fn() : (() => {}),
  addEventListener: jest.fn ? jest.fn() : (() => {}),
  removeEventListener: jest.fn ? jest.fn() : (() => {}),
  continuous: true,
  interimResults: true,
  lang: 'en-US',
  maxAlternatives: 1,
  serviceURI: '',
  grammars: null,
  onaudiostart: null,
  onaudioend: null,
  onend: null,
  onerror: null,
  onnomatch: null,
  onresult: null,
  onsoundstart: null,
  onsoundend: null,
  onspeechstart: null,
  onspeechend: null,
  onstart: null,
};

globalThis.SpeechRecognition = function() {
  return mockSpeechRecognition;
};

globalThis.webkitSpeechRecognition = globalThis.SpeechRecognition;

// Mock WebSocket
globalThis.WebSocket = class MockWebSocket {
  constructor(url: string) {
    this.url = url;
    this.readyState = 1; // OPEN
  }
  
  url: string;
  readyState: number;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  
  send(data: string | ArrayBuffer | Blob | ArrayBufferView): void {
    // Mock implementation
  }
  
  close(code?: number, reason?: string): void {
    // Mock implementation
  }
  
  addEventListener(type: string, listener: EventListener): void {
    // Mock implementation
  }
  
  removeEventListener(type: string, listener: EventListener): void {
    // Mock implementation
  }
  
  dispatchEvent(event: Event): boolean {
    return true;
  }
  
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
};

// Mock File API
globalThis.FileReader = class MockFileReader {
  result: string | ArrayBuffer | null = null;
  error: DOMException | null = null;
  readyState: number = 0;
  onabort: ((event: ProgressEvent<FileReader>) => void) | null = null;
  onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;
  onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
  onloadend: ((event: ProgressEvent<FileReader>) => void) | null = null;
  onloadstart: ((event: ProgressEvent<FileReader>) => void) | null = null;
  onprogress: ((event: ProgressEvent<FileReader>) => void) | null = null;
  
  abort(): void {}
  readAsArrayBuffer(file: Blob): void {}
  readAsBinaryString(file: Blob): void {}
  readAsDataURL(file: Blob): void {
    setTimeout(() => {
      this.result = 'data:text/plain;base64,dGVzdA==';
      this.readyState = 2;
      if (this.onload) {
        this.onload({} as ProgressEvent<FileReader>);
      }
    }, 0);
  }
  readAsText(file: Blob, encoding?: string): void {}
  
  addEventListener(type: string, listener: EventListener): void {}
  removeEventListener(type: string, listener: EventListener): void {}
  dispatchEvent(event: Event): boolean { return true; }
  
  static readonly EMPTY = 0;
  static readonly LOADING = 1;
  static readonly DONE = 2;
};

// Mock URL
globalThis.URL = class MockURL {
  constructor(url: string, base?: string) {
    this.href = url;
  }
  
  href: string;
  origin: string = 'http://localhost:3000';
  protocol: string = 'http:';
  host: string = 'localhost:3000';
  hostname: string = 'localhost';
  port: string = '3000';
  pathname: string = '/';
  search: string = '';
  hash: string = '';
  
  toString(): string {
    return this.href;
  }
  
  static createObjectURL(object: Blob | MediaSource): string {
    return 'blob:http://localhost/test';
  }
  
  static revokeObjectURL(url: string): void {}
};

// Mock console for cleaner test output
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    // Suppress specific warnings during tests
    const message = args[0];
    if (typeof message === 'string') {
      if (message.includes('Warning: ReactDOM.render is deprecated')) return;
      if (message.includes('Warning: An update to')) return;
      if (message.includes('AI Service WebSocket')) return;
    }
    originalConsoleError(...args);
  };
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  console.error = originalConsoleError;
});