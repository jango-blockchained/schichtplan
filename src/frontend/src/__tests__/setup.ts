/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll } from "bun:test";

// Setup DOM environment
import '@happy-dom/global-registrator';
import "@testing-library/jest-dom";
// Test helpers/globals
import "../test-utils/test-globals";

// Mock global APIs
if (typeof (globalThis as any).HTMLElement === 'undefined') {
  (globalThis as any).HTMLElement = (class MockHTMLElement {
  accessKey = "";
  accessKeyLabel = "";
  autocapitalize = "";
  dir = "";
  draggable = false;
  hidden = false;
  inert = false;
  innerText = "";
  lang = "";
  outerText = "";
  spellcheck = false;
  title = "";
  translate = false;
  attachInternals() { return {} as ElementInternals; }
  click() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true; }
  getAttribute() { return null; }
  setAttribute() {}
  removeAttribute() {}
  hasAttribute() { return false; }
  getAttributeNames() { return []; }
  getBoundingClientRect() { return {} as DOMRect; }
  getClientRects() { return { item: () => null, length: 0 } as unknown as DOMRectList; }
  scrollIntoView() {}
  scroll() {}
  scrollTo() {}
  scrollBy() {}
  insertAdjacentElement() { return null; }
  insertAdjacentText() {}
  insertAdjacentHTML() {}
  getElementsByTagName() { return { item: () => null, length: 0, namedItem: () => null } as unknown as HTMLCollectionOf<Element>; }
  getElementsByTagNameNS() { return { item: () => null, length: 0, namedItem: () => null } as unknown as HTMLCollectionOf<Element>; }
  getElementsByClassName() { return { item: () => null, length: 0, namedItem: () => null } as unknown as HTMLCollectionOf<Element>; }
  querySelector() { return null; }
  querySelectorAll() { return { item: () => null, length: 0 } as unknown as NodeListOf<Element>; }
  closest() { return null; }
  matches() { return false; }
  webkitMatchesSelector() { return false; }
  getAttributeNS() { return null; }
  setAttributeNS() {}
  removeAttributeNS() {}
  hasAttributeNS() { return false; }
  toggleAttribute() { return false; }
  hasAttributes() { return false; }
  getAttributeNode() { return null; }
  setAttributeNode() { return null; }
  removeAttributeNode() { return null; }
  getAttributeNodeNS() { return null; }
  setAttributeNodeNS() { return null; }
  normalize() {}
  cloneNode() { return {} as Node; }
  isEqualNode() { return false; }
  isSameNode() { return false; }
  compareDocumentPosition() { return 0; }
  contains() { return false; }
  lookupPrefix() { return null; }
  lookupNamespaceURI() { return null; }
  isDefaultNamespace() { return false; }
  appendChild() { return {} as Node; }
  insertBefore() { return {} as Node; }
  replaceChild() { return {} as Node; }
  removeChild() { return {} as Node; }
  hasChildNodes() { return false; }
  replaceChildren() {}
  getRootNode() { return {} as Node; }
  ELEMENT_NODE = 1;
  ATTRIBUTE_NODE = 2;
  TEXT_NODE = 3;
  CDATA_SECTION_NODE = 4;
  ENTITY_REFERENCE_NODE = 5;
  ENTITY_NODE = 6;
  PROCESSING_INSTRUCTION_NODE = 7;
  COMMENT_NODE = 8;
  DOCUMENT_NODE = 9;
  DOCUMENT_TYPE_NODE = 10;
  DOCUMENT_FRAGMENT_NODE = 11;
  NOTATION_NODE = 12;
  nodeType = 1;
  nodeName = "";
  nodeValue = null;
  textContent = null;
  baseURI = "";
  isConnected = false;
  ownerDocument = null;
  parentNode = null;
  parentElement = null;
  childNodes = { item: () => null, length: 0 } as unknown as NodeListOf<ChildNode>;
  firstChild = null;
  lastChild = null;
  previousSibling = null;
  nextSibling = null;
  className = "";
  classList = {
    add() {},
    remove() {},
    toggle() { return false; },
    contains() { return false; },
    replace() { return false; },
    length: 0,
    value: "",
    toString() { return ""; },
    forEach() {},
    entries() { return { next: () => ({ done: true, value: undefined }) } as IterableIterator<[number, string]>; },
    keys() { return { next: () => ({ done: true, value: undefined }) } as IterableIterator<number>; },
    values() { return { next: () => ({ done: true, value: undefined }) } as IterableIterator<string>; },
    [Symbol.iterator]() { return { next: () => ({ done: true, value: undefined }) } as IterableIterator<string>; }
  } as unknown as DOMTokenList;
  id = "";
  slot = "";
  style = {} as CSSStyleDeclaration;
  contentEditable = "inherit";
  enterKeyHint = "";
  inputMode = "";
  virtualKeyboardPolicy = "";
  onabort = null;
  onblur = null;
  oncancel = null;
  oncanplay = null;
  oncanplaythrough = null;
  onchange = null;
  onclick = null;
  onclose = null;
  oncontextmenu = null;
  oncuechange = null;
  ondblclick = null;
  ondrag = null;
  ondragend = null;
  ondragenter = null;
  ondragleave = null;
  ondragover = null;
  ondragstart = null;
  ondrop = null;
  ondurationchange = null;
  onemptied = null;
  onended = null;
  onerror = null;
  onfocus = null;
  onformdata = null;
  oninput = null;
  oninvalid = null;
  onload = null;
  onloadeddata = null;
  onloadedmetadata = null;
  onloadstart = null;
  onmousedown = null;
  onmouseenter = null;
  onmouseleave = null;
  onmousemove = null;
  onmouseout = null;
  onmouseover = null;
  onmouseup = null;
  onpause = null;
  onplay = null;
  onplaying = null;
  onprogress = null;
  onratechange = null;
  onreset = null;
  onresize = null;
  onscroll = null;
  onsecuritypolicyviolation = null;
  onseeked = null;
  onseeking = null;
  onselect = null;
  onslotchange = null;
  onstalled = null;
  onsubmit = null;
  onsuspend = null;
  ontimeupdate = null;
  ontoggle = null;
  onvolumechange = null;
  onwaiting = null;
  onwebkitanimationend = null;
  onwebkitanimationiteration = null;
  onwebkitanimationstart = null;
  onwebkittransitionend = null;
  onwheel = null;
  dataset = {} as DOMStringMap;
  nonce = "";
  tabIndex = 0;
  blur() {}
  focus() {}
  tagName = "DIV";
  scrollTop = 0;
  scrollLeft = 0;
  scrollWidth = 0;
  scrollHeight = 0;
  clientTop = 0;
  clientLeft = 0;
  clientWidth = 0;
  clientHeight = 0;
  offsetParent = null;
  offsetTop = 0;
  offsetLeft = 0;
  offsetWidth = 0;
  offsetHeight = 0;
  innerHTML = "";
  outerHTML = "";
  previousElementSibling = null;
  nextElementSibling = null;
  children = { item: () => null, length: 0, namedItem: () => null } as unknown as HTMLCollectionOf<Element>;
  firstElementChild = null;
  lastElementChild = null;
  childElementCount = 0;
  assignedSlot = null;
  shadowRoot = null;
  attachShadow() { return {} as ShadowRoot; }
  animate() { return {} as Animation; }
  getAnimations() { return [] as Animation[]; }
  before() {}
  after() {}
  replaceWith() {}
  remove() {}
  prepend() {}
  append() {}
  setPointerCapture() {}
  releasePointerCapture() {}
  hasPointerCapture() { return false; }
  requestFullscreen() { return Promise.resolve(); }
  requestPointerLock() {}
  } as any);
}

if (typeof (globalThis as any).HTMLButtonElement === 'undefined') {
  (globalThis as any).HTMLButtonElement = (class MockHTMLButtonElement extends (globalThis.HTMLElement as any) {
  disabled = false;
  form = null;
  formAction = "";
  formEnctype = "";
  formMethod = "";
  formNoValidate = false;
  formTarget = "";
  name = "";
  type = "submit";
  value = "";
  willValidate = true;
  validity = {} as ValidityState;
  validationMessage = "";
  labels = [] as any as NodeListOf<HTMLLabelElement>;
  checkValidity() { return true; }
  reportValidity() { return true; }
  setCustomValidity() {}
  } as any);
}

if (typeof (globalThis as any).HTMLInputElement === 'undefined') {
  (globalThis as any).HTMLInputElement = (class MockHTMLInputElement extends (globalThis.HTMLElement as any) {
  accept = "";
  align = "";
  alt = "";
  autocomplete = "";
  checked = false;
  defaultChecked = false;
  defaultValue = "";
  dirName = "";
  disabled = false;
  files = null;
  form = null;
  formAction = "";
  formEnctype = "";
  formMethod = "";
  formNoValidate = false;
  formTarget = "";
  height = 0;
  indeterminate = false;
  inputMode = "";
  list = null;
  max = "";
  maxLength = -1;
  min = "";
  minLength = -1;
  multiple = false;
  name = "";
  pattern = "";
  placeholder = "";
  readOnly = false;
  required = false;
  selectionDirection = null;
  selectionEnd = null;
  selectionStart = null;
  size = 0;
  src = "";
  step = "";
  type = "text";
  useMap = "";
  value = "";
  valueAsDate = null;
  valueAsNumber = NaN;
  webkitdirectory = false;
  webkitEntries = [];
  width = 0;
  willValidate = true;
  validity = {} as ValidityState;
  validationMessage = "";
  labels = [] as any as NodeListOf<HTMLLabelElement>;
  checkValidity() { return true; }
  reportValidity() { return true; }
  setCustomValidity() {}
  select() {}
  setRangeText() {}
  setSelectionRange() {}
  showPicker() { return Promise.resolve(); }
  stepDown() {}
  stepUp() {}
  } as any);
}

if (typeof (globalThis as any).HTMLDivElement === 'undefined') {
  (globalThis as any).HTMLDivElement = (class MockHTMLDivElement extends (globalThis.HTMLElement as any) {
  align = "";
  } as any);
}

// Mock Speech Recognition API
class MockSpeechRecognition {
  public calls: Array<any[]> = [];
  public listeners: Record<string, Function[]> = {};
  start = () => {};
  stop = () => {};
  abort = () => {};
  addEventListener = (type: string, listener: Function) => {
    this.calls.push([type, listener]);
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  };
  removeEventListener = (type: string, listener: Function) => {
    this.calls.push(["remove", type, listener]);
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
    }
  };
  dispatchEvent = (event: any) => {
    const type = event.type || "result";
    const listeners = this.listeners[type] || [];
    listeners.forEach((l) => {
      try {
        l(event);
      } catch (e) {
        // ignore
      }
    });
    return true;
  };
  continuous = true;
  interimResults = true;
  lang = "en-US";
  maxAlternatives = 1;
  serviceURI = "";
  grammars = null;
  onaudiostart: any = null;
  onaudioend: any = null;
  onend: any = null;
  onerror: any = null;
  onnomatch: any = null;
  onresult: any = null;
  onsoundstart: any = null;
  onsoundend: any = null;
  onspeechstart: any = null;
  onspeechend: any = null;
  onstart: any = null;
}

globalThis.SpeechRecognition = MockSpeechRecognition as any;

globalThis.webkitSpeechRecognition = globalThis.SpeechRecognition;

// Simple Mock MediaRecorder so component can call start/stop without errors
class MockMediaRecorder {
  public ondataavailable: ((e: any) => void) | null = null;
  public onstop: (() => void) | null = null;
  public state: string = "inactive";
  constructor(_stream: any, _opts?: any) {}
  start() {
    this.state = "recording";
    // produce data and auto-stop shortly after
    setTimeout(() => {
      if (this.ondataavailable) this.ondataavailable({ data: new Blob(["test"]) });
      this.stop();
    }, 10);
  }
  stop() {
    this.state = "inactive";
    if (this.onstop) this.onstop();
  }
}

globalThis.MediaRecorder = MockMediaRecorder as any;

// Minimal AudioContext/Analyser mock to allow audio level monitoring
if (typeof (globalThis as any).AudioContext === "undefined") {
  class MockAnalyser {
    frequencyBinCount = 128;
    getByteFrequencyData(arr: Uint8Array) {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 255);
    }
  }
  class MockAudioContext {
    createAnalyser() { return new MockAnalyser() as any; }
    createMediaStreamSource(_stream: any) { return { connect: () => {} } as any; }
    close() { return Promise.resolve(); }
  }
  (globalThis as any).AudioContext = MockAudioContext;
}

// Minimal XMLHttpRequest shim so axios (browser XHR) works in tests and returns our mock data.
if (typeof (globalThis as any).XMLHttpRequest === "undefined") {
  class MockXHR {
    method: string = "";
    url: string = "";
    async responseTextSetter(text: string) { this.responseText = text; }
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    status: number = 200;
    responseText: string = "";
    open(method: string, url: string) {
      this.method = method;
      this.url = url;
    }
    setRequestHeader() {}
    send(_body?: any) {
      // Simple routing
      const url = this.url || "";
      let body: any = {};
      if (url.includes("/api/v2/settings")) body = (globalThis as any).mockSettings || {};
      else if (url.includes("/api/v2/employees")) body = [];
      else if (url.includes("/api/v2/shifts")) body = [];
      else if (url.includes("/api/v2/files/upload")) body = { id: "file_1", name: "test.txt" };

      this.status = 200;
      this.responseText = JSON.stringify(body);
      if (this.onload) setTimeout(() => this.onload && this.onload(), 0);
    }
    abort() {}
  }
  (globalThis as any).XMLHttpRequest = MockXHR;
}

// Mock WebSocket
/* eslint-disable @typescript-eslint/no-unused-vars */
globalThis.WebSocket = class MockWebSocket {
  constructor(url: string) {
    this.url = url;
    this.readyState = 1; // OPEN
  }

  url: string;
  readyState: number;
  binaryType: BinaryType = "blob";
  bufferedAmount = 0;
  extensions = "";
  protocol = "";
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  send(_data: string | ArrayBuffer | Blob | ArrayBufferView): void {
    // Mock implementation
  }

  close(_code?: number, _reason?: string): void {
    // Mock implementation
  }

  addEventListener(_type: string, _listener: EventListener): void {
    // Mock implementation
  }

  removeEventListener(_type: string, _listener: EventListener): void {
    // Mock implementation
  }

  dispatchEvent(_event: Event): boolean {
    return true;
  }

  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
} as any;
/* eslint-enable @typescript-eslint/no-unused-vars */

// Mock File API
/* eslint-disable @typescript-eslint/no-unused-vars */
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
  readAsArrayBuffer(_file: Blob): void {}
  readAsBinaryString(_file: Blob): void {}
  readAsDataURL(_file: Blob): void {
    setTimeout(() => {
      this.result = "data:text/plain;base64,dGVzdA==";
      this.readyState = 2;
      if (this.onload) {
        this.onload({} as ProgressEvent<FileReader>);
      }
    }, 0);
  }
  readAsText(_file: Blob, _encoding?: string): void {}

  addEventListener(_type: string, _listener: EventListener): void {}
  removeEventListener(_type: string, _listener: EventListener): void {}
  dispatchEvent(_event: Event): boolean {
    return true;
  }

  static readonly EMPTY = 0;
  static readonly LOADING = 1;
  static readonly DONE = 2;
} as any;
/* eslint-enable @typescript-eslint/no-unused-vars */

// Mock URL
/* eslint-disable @typescript-eslint/no-unused-vars */
globalThis.URL = class MockURL {
  constructor(url: string, _base?: string) {
    this.href = url;
  }

  href: string;
  origin: string = "http://localhost:3000";
  protocol: string = "http:";
  host: string = "localhost:3000";
  hostname: string = "localhost";
  port: string = "3000";
  pathname: string = "/";
  search: string = "";
  hash: string = "";
  username: string = "";
  password: string = "";
  searchParams: URLSearchParams = new URLSearchParams();

  toString(): string {
    return this.href;
  }

  toJSON(): string {
    return this.href;
  }

  static createObjectURL(_object: Blob | MediaSource): string {
    return "blob:http://localhost/test";
  }

  static revokeObjectURL(_url: string): void {}

  static canParse(_url: string | URL, _base?: string | URL): boolean {
    return true;
  }

  static parse(_url: string | URL, _base?: string | URL): URL {
    return new MockURL(typeof _url === 'string' ? _url : _url.href) as any;
  }
};
/* eslint-enable @typescript-eslint/no-unused-vars */

// Mock console for cleaner test output
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    // Suppress specific warnings during tests
    const message = args[0];
    if (typeof message === "string") {
      if (message.includes("Warning: ReactDOM.render is deprecated")) return;
      if (message.includes("Warning: An update to")) return;
      if (message.includes("AI Service WebSocket")) return;
    }
    originalConsoleError(...args);
  };
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  console.error = originalConsoleError;
});

// Mock fetch to prevent real network calls in unit tests
if (!(globalThis as any).fetch) {
  (globalThis as any).fetch = async (input: RequestInfo) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    // Simple heuristics: return empty arrays or objects based on endpoint
    let body: any = {};
    if (url.includes("/api/v2/settings")) body = (globalThis as any).mockSettings;
    else if (url.includes("/api/v2/files/upload")) body = { id: "file_1", name: "test.txt" };
    else if (url.includes("/api/v2/employees")) body = [];
    else if (url.includes("/api/v2/shifts")) body = [];

    return {
      ok: true,
      status: 200,
      json: async () => body,
    } as Response;
  };
}

// Monkey-patch frontend service modules to use our test globals where possible.
// This prevents axios/aiService from making real network requests during unit tests.
(async () => {
  try {
    const apiModule = await import("../services/api");
    const aiModule = await import("../services/aiService");
    const g: any = globalThis as any;

    if (g.api) {
      // Replace selected exported functions with test-friendly wrappers
      if (apiModule && typeof apiModule.getSettings === "function") {
        apiModule.getSettings = async () => g.api.getSettings();
      }
      if (apiModule && typeof apiModule.updateSettings === "function") {
        apiModule.updateSettings = async (s: any) => g.api.updateSettings(s);
      }
      if (apiModule && typeof apiModule.getEmployees === "function") {
        apiModule.getEmployees = async () => [];
      }
      if (apiModule && typeof apiModule.getShifts === "function") {
        apiModule.getShifts = async () => [];
      }
    }

    if (aiModule) {
      // Expose a global test AI service that tests can override if needed
      const testAi = {
        uploadFile: async (_file: any) => ({ id: "file_1", name: "test.txt", type: "text/plain", size: 1000 }),
        analyzeFile: async (_id: string) => ({ id: "file_1", analysis: {}, processed: true }),
        processVoiceCommand: async (_blob: any) => ({ transcript: "test", confidence: 0.95, id: "vc_1", timestamp: new Date() }),
      };
      (globalThis as any).__TEST_AI_SERVICE = testAi;
    }
  } catch (e) {
    // ignore module load errors in environments where modules are not available
  }
})();

// Provide a test MediaRecorder implementation if not available
if (typeof (globalThis as any).MediaRecorder === "undefined") {
  class MockMediaRecorder {
    state = "inactive";
    ondataavailable: any = null;
    onstop: any = null;
    chunks: any[] = [];
    constructor(_stream: any, _opts?: any) {}
    start() { this.state = "recording"; }
    stop() { this.state = "inactive"; if (this.ondataavailable) this.ondataavailable({ data: new Blob([]) }); if (this.onstop) this.onstop(); }
    addEventListener(_type: string, _cb: any) {}
    removeEventListener(_type: string, _cb: any) {}
  }
  (globalThis as any).MediaRecorder = MockMediaRecorder;
}
