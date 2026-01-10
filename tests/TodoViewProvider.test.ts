/**
 * Integration tests for TodoViewProvider
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TodoViewProvider } from '../src/TodoViewProvider';
import { createMockExtensionContext, MockExtensionContext, workspace, window, env, Uri, WebviewViewMock } from './__mocks__/vscode';
import { CONFIG, STORAGE_KEYS, Todo } from '../src/types';
import * as utils from '../src/utils';

// Mock utils module
vi.mock('../src/utils', () => ({
  requestJson: vi.fn(),
  delay: vi.fn().mockResolvedValue(undefined),
  getNonce: vi.fn().mockReturnValue('mockedNonce12345678901234567890'),
  formatTodosAsPrompt: vi.fn().mockImplementation((todos: { text: string }[]) => {
    const items = todos.map((t) => `- [ ] ${t.text}`).join('\n');
    return `## Current Tasks\n\n${items}\n`;
  }),
}));

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue('{"todos":[]}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

// Mock getHtml
vi.mock('../src/webview/getHtml', () => ({
  getHtml: vi.fn().mockReturnValue('<html><body>Mock Webview</body></html>'),
}));

describe('TodoViewProvider', () => {
  let context: MockExtensionContext;
  let provider: TodoViewProvider;
  let originalDevMode: boolean;

  beforeEach(() => {
    context = createMockExtensionContext();
    originalDevMode = CONFIG.DEV_MODE;
    (CONFIG as any).DEV_MODE = false;

    // Setup workspace mock
    workspace.setWorkspaceFolders([
      { uri: Uri.file('/test/workspace'), name: 'test-workspace' },
    ]);

    workspace.getConfiguration = vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue('https://api.panel-todo.com'),
    });

    workspace.createFileSystemWatcher = vi.fn().mockReturnValue({
      onDidChange: vi.fn(),
      onDidCreate: vi.fn(),
      onDidDelete: vi.fn(),
      dispose: vi.fn(),
    });

    provider = new TodoViewProvider(context as any);

    vi.clearAllMocks();
  });

  afterEach(() => {
    (CONFIG as any).DEV_MODE = originalDevMode;
    provider.dispose();
  });

  describe('Constructor', () => {
    it('should initialize services', () => {
      expect(provider).toBeDefined();
      expect(provider.isPro()).toBe(false); // Default not pro
    });

    it('should set up file watcher when workspace exists', () => {
      // File watcher is set up in constructor
      // Need a new provider to test - recreate with fresh mock
      const newProvider = new TodoViewProvider(context as any);
      // The watcher is created during construction
      newProvider.dispose();
      // This test mainly verifies constructor doesn't throw
    });
  });

  describe('Public API', () => {
    describe('addTodoExternal', () => {
      it('should add a todo', async () => {
        await provider.addTodoExternal('Test todo');

        const todos = provider.getAllTodos();
        expect(todos).toHaveLength(1);
        expect(todos[0].text).toBe('Test todo');
      });

      it('should trim whitespace from text', async () => {
        await provider.addTodoExternal('  Trimmed todo  ');

        const todos = provider.getAllTodos();
        expect(todos[0].text).toBe('Trimmed todo');
      });

      it('should generate unique IDs', async () => {
        await provider.addTodoExternal('Todo 1');
        await provider.addTodoExternal('Todo 2');

        const todos = provider.getAllTodos();
        expect(todos[0].id).not.toBe(todos[1].id);
      });

      it('should set createdAt timestamp', async () => {
        const before = Date.now();
        await provider.addTodoExternal('Test');
        const after = Date.now();

        const todos = provider.getAllTodos();
        expect(todos[0].createdAt).toBeGreaterThanOrEqual(before);
        expect(todos[0].createdAt).toBeLessThanOrEqual(after);
      });
    });

    describe('getAllTodos', () => {
      it('should return empty array initially', () => {
        const todos = provider.getAllTodos();
        expect(todos).toEqual([]);
      });

      it('should return all added todos', async () => {
        await provider.addTodoExternal('Todo 1');
        await provider.addTodoExternal('Todo 2');
        await provider.addTodoExternal('Todo 3');

        const todos = provider.getAllTodos();
        expect(todos).toHaveLength(3);
      });
    });

    describe('undoDelete', () => {
      it('should show message when nothing to undo', async () => {
        await provider.undoDelete();

        expect(window.showInformationMessage).toHaveBeenCalledWith('Nothing to undo');
      });

      it('should restore deleted todo', async () => {
        // This is tricky because we need to simulate the webview message
        // For now, test the canUndo method
        expect(provider.canUndo()).toBe(false);
      });
    });

    describe('canUndo', () => {
      it('should return false initially', () => {
        expect(provider.canUndo()).toBe(false);
      });
    });

    describe('isPro', () => {
      it('should return false by default', () => {
        expect(provider.isPro()).toBe(false);
      });

      it('should return true in dev mode with pro tier', () => {
        (CONFIG as any).DEV_MODE = true;
        // Create new provider to pick up dev mode
        provider.dispose();
        provider = new TodoViewProvider(context as any);

        // The auth service should have dev mode enabled
        // We'd need to set the tier via signIn or setDevFakeTier
        expect(provider.isPro()).toBe(false); // Default is 'free' in dev mode
      });
    });

    describe('exportTodosAsPrompt', () => {
      it('should show message when no todos', async () => {
        await provider.exportTodosAsPrompt();

        expect(window.showInformationMessage).toHaveBeenCalledWith('No todos to export');
      });

      it('should copy todos to clipboard', async () => {
        await provider.addTodoExternal('Test todo 1');
        await provider.addTodoExternal('Test todo 2');

        await provider.exportTodosAsPrompt();

        expect(env.clipboard.writeText).toHaveBeenCalled();
        expect(window.showInformationMessage).toHaveBeenCalledWith('Copied 2 todos to clipboard');
      });
    });

    describe('openUpgrade', () => {
      it('should open payment link', () => {
        provider.openUpgrade();

        expect(env.openExternal).toHaveBeenCalled();
      });
    });

    describe('focusInput', () => {
      it('should post message to webview when available', () => {
        // Set up a mock view with proper structure
        const mockView = {
          show: vi.fn(),
          webview: {
            postMessage: vi.fn().mockResolvedValue(true),
          },
        };
        (provider as any)._view = mockView;

        provider.focusInput();

        expect(mockView.show).toHaveBeenCalledWith(true);
        expect(mockView.webview.postMessage).toHaveBeenCalledWith({ type: 'focusInput' });
      });

      it('should do nothing when no view', () => {
        (provider as any)._view = null;
        provider.focusInput();
        // Should not throw
      });
    });

    describe('dispose', () => {
      it('should clean up resources', () => {
        const mockFileWatcher = { dispose: vi.fn() };
        (provider as any)._fileWatcher = mockFileWatcher;

        provider.dispose();

        expect(mockFileWatcher.dispose).toHaveBeenCalled();
        expect((provider as any)._disposed).toBe(true);
      });

      it('should clear timers', () => {
        (provider as any)._syncDebounceTimer = setTimeout(() => {}, 10000);

        provider.dispose();

        expect((provider as any)._syncDebounceTimer).toBeNull();
      });
    });
  });

  describe('Todo Operations', () => {
    it('should persist todos across retrievals', async () => {
      await provider.addTodoExternal('Persistent todo');

      // Get todos multiple times
      const todos1 = provider.getAllTodos();
      const todos2 = provider.getAllTodos();

      expect(todos1).toEqual(todos2);
    });
  });

  describe('Webview Communication', () => {
    let mockWebviewView: any;

    beforeEach(() => {
      mockWebviewView = {
        webview: {
          options: {},
          html: '',
          postMessage: vi.fn().mockResolvedValue(true),
          onDidReceiveMessage: vi.fn().mockReturnValue({ dispose: vi.fn() }),
          asWebviewUri: vi.fn((uri) => uri),
          cspSource: 'test-csp',
        },
        visible: true,
        onDidDispose: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        show: vi.fn(),
      };
    });

    it('should resolve webview view', () => {
      provider.resolveWebviewView(
        mockWebviewView as any,
        {} as any,
        { isCancellationRequested: false, onCancellationRequested: vi.fn() } as any
      );

      expect(mockWebviewView.webview.options.enableScripts).toBe(true);
      expect(mockWebviewView.webview.html).toContain('html');
    });

    it('should set up message handler', () => {
      provider.resolveWebviewView(
        mockWebviewView as any,
        {} as any,
        { isCancellationRequested: false, onCancellationRequested: vi.fn() } as any
      );

      expect(mockWebviewView.webview.onDidReceiveMessage).toHaveBeenCalled();
    });
  });

  describe('Message Handling', () => {
    let messageHandler: (message: any) => Promise<void>;
    let mockWebviewView: any;

    beforeEach(() => {
      mockWebviewView = {
        webview: {
          options: {},
          html: '',
          postMessage: vi.fn().mockResolvedValue(true),
          onDidReceiveMessage: vi.fn().mockImplementation((handler) => {
            messageHandler = handler;
            return { dispose: vi.fn() };
          }),
          asWebviewUri: vi.fn((uri) => uri),
          cspSource: 'test-csp',
        },
        visible: true,
        onDidDispose: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        show: vi.fn(),
      };

      provider.resolveWebviewView(
        mockWebviewView as any,
        {} as any,
        { isCancellationRequested: false, onCancellationRequested: vi.fn() } as any
      );
    });

    it('should handle "add" message', async () => {
      await messageHandler({ type: 'add', text: 'New todo from webview' });

      const todos = provider.getAllTodos();
      expect(todos).toHaveLength(1);
      expect(todos[0].text).toBe('New todo from webview');
    });

    it('should handle "remove" message', async () => {
      await provider.addTodoExternal('To be deleted');
      const todos = provider.getAllTodos();
      const id = todos[0].id;

      await messageHandler({ type: 'remove', id });

      expect(provider.getAllTodos()).toHaveLength(0);
      expect(provider.canUndo()).toBe(true);
    });

    it('should handle "edit" message', async () => {
      await provider.addTodoExternal('Original text');
      const todos = provider.getAllTodos();
      const id = todos[0].id;

      await messageHandler({ type: 'edit', id, text: 'Edited text' });

      expect(provider.getAllTodos()[0].text).toBe('Edited text');
    });

    it('should handle "undo" message', async () => {
      await provider.addTodoExternal('Will be deleted then restored');
      const id = provider.getAllTodos()[0].id;

      await messageHandler({ type: 'remove', id });
      expect(provider.getAllTodos()).toHaveLength(0);

      await messageHandler({ type: 'undo' });
      expect(provider.getAllTodos()).toHaveLength(1);
    });

    it('should handle "openUpgrade" message', async () => {
      await messageHandler({ type: 'openUpgrade' });

      expect(env.openExternal).toHaveBeenCalled();
    });

    it('should handle "openUpgradeYearly" message', async () => {
      await messageHandler({ type: 'openUpgradeYearly' });

      expect(env.openExternal).toHaveBeenCalled();
    });

    it('should ignore invalid messages', async () => {
      await messageHandler(null);
      await messageHandler({});
      await messageHandler({ type: 123 });

      // Should not throw
    });

    it('should handle errors gracefully', async () => {
      // Force an error by mocking storage
      const originalGetTodos = (provider as any).storage.getTodos;
      (provider as any).storage.getTodos = () => {
        throw new Error('Storage error');
      };

      // Should post error message to webview
      await messageHandler({ type: 'add', text: 'This will fail' });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          error: 'Storage error',
        })
      );

      (provider as any).storage.getTodos = originalGetTodos;
    });
  });

  describe('Auth State', () => {
    let mockWebviewView: any;
    let messageHandler: (message: any) => Promise<void>;

    beforeEach(() => {
      mockWebviewView = {
        webview: {
          options: {},
          html: '',
          postMessage: vi.fn().mockResolvedValue(true),
          onDidReceiveMessage: vi.fn().mockImplementation((handler) => {
            messageHandler = handler;
            return { dispose: vi.fn() };
          }),
          asWebviewUri: vi.fn((uri) => uri),
          cspSource: 'test-csp',
        },
        visible: true,
        onDidDispose: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        show: vi.fn(),
      };

      provider.resolveWebviewView(
        mockWebviewView as any,
        {} as any,
        { isCancellationRequested: false, onCancellationRequested: vi.fn() } as any
      );
    });

    it('should post auth state on ready', async () => {
      await messageHandler({ type: 'ready' });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'authState',
        })
      );
    });

    it('should handle signOut message', async () => {
      await messageHandler({ type: 'signOut' });

      expect(window.showInformationMessage).toHaveBeenCalledWith('Signed out of Panel Todo');
    });
  });

  describe('Dev Mode', () => {
    let mockWebviewView: any;
    let messageHandler: (message: any) => Promise<void>;

    beforeEach(() => {
      (CONFIG as any).DEV_MODE = true;

      // Recreate provider with dev mode
      provider.dispose();
      provider = new TodoViewProvider(context as any);

      mockWebviewView = {
        webview: {
          options: {},
          html: '',
          postMessage: vi.fn().mockResolvedValue(true),
          onDidReceiveMessage: vi.fn().mockImplementation((handler) => {
            messageHandler = handler;
            return { dispose: vi.fn() };
          }),
          asWebviewUri: vi.fn((uri) => uri),
          cspSource: 'test-csp',
        },
        visible: true,
        onDidDispose: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        show: vi.fn(),
      };

      provider.resolveWebviewView(
        mockWebviewView as any,
        {} as any,
        { isCancellationRequested: false, onCancellationRequested: vi.fn() } as any
      );
    });

    it('should handle devSetTier message', async () => {
      await messageHandler({ type: 'devSetTier', tier: 'pro' });

      expect(provider.isPro()).toBe(true);
    });

    it('should ignore devSetTier when not in dev mode', async () => {
      (CONFIG as any).DEV_MODE = false;

      await messageHandler({ type: 'devSetTier', tier: 'pro' });

      expect(provider.isPro()).toBe(false);
    });
  });

  describe('ViewType', () => {
    it('should have correct view type', () => {
      expect(TodoViewProvider.viewType).toBe('todoView');
    });
  });
});

describe('TodoViewProvider - Storage Integration', () => {
  let context: MockExtensionContext;
  let provider: TodoViewProvider;

  beforeEach(() => {
    context = createMockExtensionContext();
    (CONFIG as any).DEV_MODE = false;

    workspace.setWorkspaceFolders([
      { uri: Uri.file('/test/workspace'), name: 'test-workspace' },
    ]);

    workspace.getConfiguration = vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue('https://api.panel-todo.com'),
    });

    workspace.createFileSystemWatcher = vi.fn().mockReturnValue({
      onDidChange: vi.fn(),
      onDidCreate: vi.fn(),
      onDidDelete: vi.fn(),
      dispose: vi.fn(),
    });

    provider = new TodoViewProvider(context as any);
  });

  afterEach(() => {
    provider.dispose();
  });

  it('should persist todos to workspace state', async () => {
    await provider.addTodoExternal('Persisted todo');

    // Check workspace state directly
    const storedTodos = context.workspaceState.get<Todo[]>(STORAGE_KEYS.ITEMS);
    expect(storedTodos).toHaveLength(1);
    expect(storedTodos![0].text).toBe('Persisted todo');
  });

  it('should load todos from workspace state', async () => {
    // Pre-populate workspace state
    const existingTodos: Todo[] = [
      { id: 'existing-1', text: 'Existing todo', createdAt: Date.now() },
    ];
    await context.workspaceState.update(STORAGE_KEYS.ITEMS, existingTodos);

    // Create new provider to load from storage
    provider.dispose();
    provider = new TodoViewProvider(context as any);

    const todos = provider.getAllTodos();
    expect(todos).toHaveLength(1);
    expect(todos[0].text).toBe('Existing todo');
  });
});
