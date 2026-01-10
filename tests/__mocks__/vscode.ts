/**
 * VS Code API Mock for testing
 * Provides mock implementations of VS Code APIs used by the extension
 */

import { vi } from 'vitest';
import { EventEmitter } from 'events';

// ============================================
// URI Mock
// ============================================

export class Uri {
  readonly scheme: string;
  readonly authority: string;
  readonly path: string;
  readonly query: string;
  readonly fragment: string;
  readonly fsPath: string;

  private constructor(
    scheme: string,
    authority: string,
    path: string,
    query: string,
    fragment: string
  ) {
    this.scheme = scheme;
    this.authority = authority;
    this.path = path;
    this.query = query;
    this.fragment = fragment;
    this.fsPath = path;
  }

  static parse(value: string): Uri {
    try {
      const url = new URL(value);
      return new Uri(
        url.protocol.replace(':', ''),
        url.host,
        url.pathname,
        url.search.replace('?', ''),
        url.hash.replace('#', '')
      );
    } catch {
      return new Uri('file', '', value, '', '');
    }
  }

  static file(path: string): Uri {
    return new Uri('file', '', path, '', '');
  }

  toString(): string {
    return `${this.scheme}://${this.authority}${this.path}`;
  }

  with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): Uri {
    return new Uri(
      change.scheme ?? this.scheme,
      change.authority ?? this.authority,
      change.path ?? this.path,
      change.query ?? this.query,
      change.fragment ?? this.fragment
    );
  }
}

// ============================================
// Secrets Mock
// ============================================

export class SecretStorageMock {
  private secrets = new Map<string, string>();

  async get(key: string): Promise<string | undefined> {
    return this.secrets.get(key);
  }

  async store(key: string, value: string): Promise<void> {
    this.secrets.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.secrets.delete(key);
  }

  // Test helper to clear all secrets
  clear(): void {
    this.secrets.clear();
  }
}

// ============================================
// Memento Mock (workspaceState/globalState)
// ============================================

export class MementoMock {
  private storage = new Map<string, unknown>();

  get<T>(key: string, defaultValue?: T): T | undefined {
    const value = this.storage.get(key);
    return value !== undefined ? (value as T) : defaultValue;
  }

  async update(key: string, value: unknown): Promise<void> {
    if (value === undefined) {
      this.storage.delete(key);
    } else {
      this.storage.set(key, value);
    }
  }

  keys(): readonly string[] {
    return Array.from(this.storage.keys());
  }

  // Test helper to clear all storage
  clear(): void {
    this.storage.clear();
  }

  // Test helper to set values directly
  setForTest(key: string, value: unknown): void {
    this.storage.set(key, value);
  }
}

// ============================================
// Extension Context Mock
// ============================================

export function createMockExtensionContext(): MockExtensionContext {
  const secrets = new SecretStorageMock();
  const workspaceState = new MementoMock();
  const globalState = new MementoMock();

  return {
    subscriptions: [],
    extensionPath: '/mock/extension/path',
    extensionUri: Uri.file('/mock/extension/path'),
    globalStoragePath: '/mock/global/storage',
    globalStorageUri: Uri.file('/mock/global/storage'),
    logPath: '/mock/log/path',
    logUri: Uri.file('/mock/log/path'),
    storagePath: '/mock/storage/path',
    storageUri: Uri.file('/mock/storage/path'),
    asAbsolutePath: (relativePath: string) => `/mock/extension/path/${relativePath}`,
    workspaceState,
    globalState,
    secrets,
    extensionMode: 1, // ExtensionMode.Test
    environmentVariableCollection: {} as any,
    extension: {
      id: 'mock.panel-todo',
      extensionUri: Uri.file('/mock/extension/path'),
      extensionPath: '/mock/extension/path',
      isActive: true,
      packageJSON: { name: 'panel-todo', version: '0.3.0' },
      exports: undefined,
      activate: vi.fn(),
      extensionKind: 1,
    },
    languageModelAccessInformation: {} as any,
  };
}

export interface MockExtensionContext {
  subscriptions: { dispose(): void }[];
  extensionPath: string;
  extensionUri: Uri;
  globalStoragePath: string;
  globalStorageUri: Uri;
  logPath: string;
  logUri: Uri;
  storagePath: string | undefined;
  storageUri: Uri | undefined;
  asAbsolutePath(relativePath: string): string;
  workspaceState: MementoMock;
  globalState: MementoMock;
  secrets: SecretStorageMock;
  extensionMode: number;
  environmentVariableCollection: any;
  extension: any;
  languageModelAccessInformation: any;
}

// ============================================
// Workspace Mock
// ============================================

const workspaceFoldersMock: WorkspaceFolder[] = [];

export interface WorkspaceFolder {
  uri: Uri;
  name: string;
  index: number;
}

export const workspace = {
  workspaceFolders: workspaceFoldersMock,
  getConfiguration: vi.fn().mockReturnValue({
    get: vi.fn().mockImplementation((key: string, defaultValue?: unknown) => defaultValue),
    has: vi.fn().mockReturnValue(false),
    inspect: vi.fn().mockReturnValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  }),
  onDidChangeConfiguration: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onDidChangeWorkspaceFolders: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  fs: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    delete: vi.fn(),
    stat: vi.fn(),
    createDirectory: vi.fn(),
  },
  // Test helper
  setWorkspaceFolders: (folders: { uri: Uri; name: string }[]) => {
    workspaceFoldersMock.length = 0;
    folders.forEach((folder, index) => {
      workspaceFoldersMock.push({ ...folder, index });
    });
    workspace.workspaceFolders = workspaceFoldersMock;
  },
};

// ============================================
// Window Mock
// ============================================

export const window = {
  showInformationMessage: vi.fn().mockResolvedValue(undefined),
  showErrorMessage: vi.fn().mockResolvedValue(undefined),
  showWarningMessage: vi.fn().mockResolvedValue(undefined),
  showQuickPick: vi.fn().mockResolvedValue(undefined),
  showInputBox: vi.fn().mockResolvedValue(undefined),
  createWebviewPanel: vi.fn(),
  registerWebviewViewProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  registerUriHandler: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  createStatusBarItem: vi.fn().mockReturnValue({
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
    text: '',
    tooltip: '',
    command: undefined,
  }),
  createOutputChannel: vi.fn().mockReturnValue({
    appendLine: vi.fn(),
    append: vi.fn(),
    clear: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
  }),
  createTextEditorDecorationType: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  activeTextEditor: undefined as TextEditor | undefined,
  visibleTextEditors: [] as TextEditor[],
  onDidChangeActiveTextEditor: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  withProgress: vi.fn().mockImplementation(
    async (_options: unknown, task: (progress: unknown) => Promise<unknown>) => {
      return task({ report: vi.fn() });
    }
  ),
};

export interface TextEditor {
  document: {
    getText: (range?: Range) => string;
    uri: Uri;
    fileName: string;
  };
  selection: {
    isEmpty: boolean;
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

// ============================================
// Commands Mock
// ============================================

const commandHandlers = new Map<string, (...args: unknown[]) => unknown>();

export const commands = {
  registerCommand: vi.fn().mockImplementation((command: string, handler: (...args: unknown[]) => unknown) => {
    commandHandlers.set(command, handler);
    return { dispose: () => commandHandlers.delete(command) };
  }),
  executeCommand: vi.fn().mockImplementation(async (command: string, ...args: unknown[]) => {
    const handler = commandHandlers.get(command);
    if (handler) {
      return handler(...args);
    }
    return undefined;
  }),
  getCommands: vi.fn().mockResolvedValue([]),
};

// ============================================
// Env Mock
// ============================================

export const env = {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
  openExternal: vi.fn().mockResolvedValue(true),
  uriScheme: 'vscode',
  appName: 'VS Code Test',
  machineId: 'test-machine-id',
  sessionId: 'test-session-id',
  language: 'en',
  shell: '/bin/bash',
};

// ============================================
// Range & Position
// ============================================

export class Position {
  constructor(public readonly line: number, public readonly character: number) {}

  isEqual(other: Position): boolean {
    return this.line === other.line && this.character === other.character;
  }

  isBefore(other: Position): boolean {
    return this.line < other.line || (this.line === other.line && this.character < other.character);
  }

  isAfter(other: Position): boolean {
    return other.isBefore(this);
  }

  translate(lineDelta?: number, characterDelta?: number): Position {
    return new Position(
      this.line + (lineDelta ?? 0),
      this.character + (characterDelta ?? 0)
    );
  }

  with(line?: number, character?: number): Position {
    return new Position(line ?? this.line, character ?? this.character);
  }
}

export class Range {
  constructor(
    public readonly start: Position,
    public readonly end: Position
  ) {}

  static create(startLine: number, startChar: number, endLine: number, endChar: number): Range {
    return new Range(new Position(startLine, startChar), new Position(endLine, endChar));
  }

  get isEmpty(): boolean {
    return this.start.isEqual(this.end);
  }

  contains(positionOrRange: Position | Range): boolean {
    if (positionOrRange instanceof Position) {
      return !positionOrRange.isBefore(this.start) && !positionOrRange.isAfter(this.end);
    }
    return this.contains(positionOrRange.start) && this.contains(positionOrRange.end);
  }
}

export class Selection extends Range {
  constructor(
    public readonly anchor: Position,
    public readonly active: Position
  ) {
    super(anchor, active);
  }
}

// ============================================
// Webview Mock
// ============================================

export class WebviewViewMock {
  private _html = '';
  private _options: WebviewOptions = {};
  private _messageHandler: ((message: unknown) => void) | null = null;
  private _visible = true;
  private _emitter = new EventEmitter();

  get webview(): WebviewMock {
    return {
      html: this._html,
      options: this._options,
      asWebviewUri: (uri: Uri) => uri,
      cspSource: 'https://test.vscode',
      postMessage: vi.fn().mockResolvedValue(true),
      onDidReceiveMessage: (handler: (message: unknown) => void) => {
        this._messageHandler = handler;
        return { dispose: () => { this._messageHandler = null; } };
      },
      // Test helper to simulate receiving a message
      receiveMessage: (message: unknown) => {
        if (this._messageHandler) {
          this._messageHandler(message);
        }
      },
    } as WebviewMock;
  }

  get visible(): boolean {
    return this._visible;
  }

  set visible(value: boolean) {
    this._visible = value;
  }

  get onDidDispose() {
    return this._emitter.on.bind(this._emitter, 'dispose');
  }

  get onDidChangeVisibility() {
    return this._emitter.on.bind(this._emitter, 'visibility');
  }

  show(): void {
    this._visible = true;
    this._emitter.emit('visibility');
  }

  dispose(): void {
    this._emitter.emit('dispose');
  }
}

export interface WebviewMock {
  html: string;
  options: WebviewOptions;
  asWebviewUri(uri: Uri): Uri;
  cspSource: string;
  postMessage(message: unknown): Promise<boolean>;
  onDidReceiveMessage(handler: (message: unknown) => void): { dispose(): void };
  receiveMessage(message: unknown): void;
}

export interface WebviewOptions {
  enableScripts?: boolean;
  localResourceRoots?: Uri[];
}

// ============================================
// Enums
// ============================================

export enum ExtensionMode {
  Production = 1,
  Development = 2,
  Test = 3,
}

export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
  Two = 2,
  Three = 3,
}

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15,
}

// ============================================
// Disposable
// ============================================

export class Disposable {
  constructor(private callOnDispose: () => void) {}

  dispose(): void {
    this.callOnDispose();
  }

  static from(...disposables: { dispose(): void }[]): Disposable {
    return new Disposable(() => {
      disposables.forEach((d) => d.dispose());
    });
  }
}

// ============================================
// EventEmitter (VS Code style)
// ============================================

export class EventEmitterVSCode<T> {
  private _event = new EventEmitter();

  get event(): (listener: (e: T) => void) => Disposable {
    return (listener: (e: T) => void) => {
      this._event.on('event', listener);
      return new Disposable(() => this._event.off('event', listener));
    };
  }

  fire(data: T): void {
    this._event.emit('event', data);
  }

  dispose(): void {
    this._event.removeAllListeners();
  }
}

// Export as EventEmitter for VS Code compatibility
export { EventEmitterVSCode as EventEmitter };

// ============================================
// RelativePattern Mock
// ============================================

export class RelativePattern {
  constructor(
    public readonly base: WorkspaceFolder | Uri | string,
    public readonly pattern: string
  ) {}
}

// ============================================
// Default Export
// ============================================

export default {
  Uri,
  workspace,
  window,
  commands,
  env,
  Position,
  Range,
  Selection,
  ExtensionMode,
  ViewColumn,
  StatusBarAlignment,
  ProgressLocation,
  Disposable,
  EventEmitter: EventEmitterVSCode,
  RelativePattern,
};
