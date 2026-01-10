/**
 * Unit tests for extension.ts entry point
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockExtensionContext,
  MockExtensionContext,
  window,
  commands,
  Uri,
} from './__mocks__/vscode';

// Create a mock provider that we can reference
const mockProvider = {
  addTodoFromSelection: vi.fn(),
  exportTodosAsPrompt: vi.fn(),
  focusInput: vi.fn(),
  undoDelete: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  openUpgrade: vi.fn(),
  dispose: vi.fn(),
};

// Mock TodoViewProvider before importing extension
vi.mock('../src/TodoViewProvider', () => ({
  TodoViewProvider: vi.fn().mockImplementation(() => mockProvider),
}));

// Import after mocking
import { activate, deactivate } from '../src/extension';

describe('extension', () => {
  let context: MockExtensionContext;

  beforeEach(() => {
    context = createMockExtensionContext();
    vi.clearAllMocks();

    // Reset mock provider methods
    mockProvider.addTodoFromSelection.mockClear();
    mockProvider.exportTodosAsPrompt.mockClear();
    mockProvider.focusInput.mockClear();
    mockProvider.undoDelete.mockClear();
    mockProvider.signIn.mockClear();
    mockProvider.signOut.mockClear();
    mockProvider.openUpgrade.mockClear();
    mockProvider.dispose.mockClear();
  });

  afterEach(() => {
    // Clean up after each test
    deactivate();
  });

  describe('activate', () => {
    it('should register webview view provider', () => {
      activate(context as any);

      expect(window.registerWebviewViewProvider).toHaveBeenCalledWith(
        'todoView',
        expect.any(Object),
        expect.objectContaining({
          webviewOptions: {
            retainContextWhenHidden: true,
          },
        })
      );
    });

    it('should add view registration to subscriptions', () => {
      const initialLength = context.subscriptions.length;

      activate(context as any);

      // Should have view registration + URI handler + 7 commands = 9 new subscriptions
      expect(context.subscriptions.length).toBe(initialLength + 9);
    });

    it('should register URI handler', () => {
      activate(context as any);

      expect(window.registerUriHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          handleUri: expect.any(Function),
        })
      );
    });

    it('should register all commands', () => {
      activate(context as any);

      const expectedCommands = [
        'panelTodo.addFromSelection',
        'panelTodo.exportAsPrompt',
        'panelTodo.focusInput',
        'panelTodo.undoDelete',
        'panelTodo.signIn',
        'panelTodo.signOut',
        'panelTodo.upgrade',
      ];

      for (const cmd of expectedCommands) {
        expect(commands.registerCommand).toHaveBeenCalledWith(cmd, expect.any(Function));
      }
    });
  });

  describe('deactivate', () => {
    it('should dispose provider on deactivation', () => {
      activate(context as any);
      deactivate();

      expect(mockProvider.dispose).toHaveBeenCalled();
    });

    it('should not throw when called without activation', () => {
      // First deactivate clears the provider from afterEach
      // This tests calling deactivate when provider is already undefined
      expect(() => deactivate()).not.toThrow();
    });
  });

  describe('commands', () => {
    beforeEach(() => {
      activate(context as any);
    });

    describe('panelTodo.addFromSelection', () => {
      it('should add todo from selected text', () => {
        // Setup mock editor with selection
        const mockEditor = {
          document: {
            getText: vi.fn().mockReturnValue('Selected task text'),
          },
          selection: {},
        };
        window.activeTextEditor = mockEditor as any;

        // Find and execute the command handler
        const addFromSelectionCall = vi.mocked(commands.registerCommand).mock.calls.find(
          (call) => call[0] === 'panelTodo.addFromSelection'
        );
        const handler = addFromSelectionCall?.[1] as () => void;
        handler();

        expect(mockProvider.addTodoFromSelection).toHaveBeenCalledWith('Selected task text');
      });

      it('should show message when no text is selected', () => {
        const mockEditor = {
          document: {
            getText: vi.fn().mockReturnValue('   '),
          },
          selection: {},
        };
        window.activeTextEditor = mockEditor as any;

        const addFromSelectionCall = vi.mocked(commands.registerCommand).mock.calls.find(
          (call) => call[0] === 'panelTodo.addFromSelection'
        );
        const handler = addFromSelectionCall?.[1] as () => void;
        handler();

        expect(window.showInformationMessage).toHaveBeenCalledWith('No text selected');
        expect(mockProvider.addTodoFromSelection).not.toHaveBeenCalled();
      });

      it('should do nothing when no editor is active', () => {
        window.activeTextEditor = undefined;

        const addFromSelectionCall = vi.mocked(commands.registerCommand).mock.calls.find(
          (call) => call[0] === 'panelTodo.addFromSelection'
        );
        const handler = addFromSelectionCall?.[1] as () => void;
        handler();

        expect(mockProvider.addTodoFromSelection).not.toHaveBeenCalled();
      });
    });

    describe('panelTodo.exportAsPrompt', () => {
      it('should call exportTodosAsPrompt on provider', () => {
        const exportCall = vi.mocked(commands.registerCommand).mock.calls.find(
          (call) => call[0] === 'panelTodo.exportAsPrompt'
        );
        const handler = exportCall?.[1] as () => void;
        handler();

        expect(mockProvider.exportTodosAsPrompt).toHaveBeenCalled();
      });
    });

    describe('panelTodo.focusInput', () => {
      it('should call focusInput on provider', () => {
        const focusCall = vi.mocked(commands.registerCommand).mock.calls.find(
          (call) => call[0] === 'panelTodo.focusInput'
        );
        const handler = focusCall?.[1] as () => void;
        handler();

        expect(mockProvider.focusInput).toHaveBeenCalled();
      });
    });

    describe('panelTodo.undoDelete', () => {
      it('should call undoDelete on provider', () => {
        const undoCall = vi.mocked(commands.registerCommand).mock.calls.find(
          (call) => call[0] === 'panelTodo.undoDelete'
        );
        const handler = undoCall?.[1] as () => void;
        handler();

        expect(mockProvider.undoDelete).toHaveBeenCalled();
      });
    });

    describe('panelTodo.signIn', () => {
      it('should call signIn on provider', () => {
        const signInCall = vi.mocked(commands.registerCommand).mock.calls.find(
          (call) => call[0] === 'panelTodo.signIn'
        );
        const handler = signInCall?.[1] as () => void;
        handler();

        expect(mockProvider.signIn).toHaveBeenCalled();
      });
    });

    describe('panelTodo.signOut', () => {
      it('should call signOut on provider', () => {
        const signOutCall = vi.mocked(commands.registerCommand).mock.calls.find(
          (call) => call[0] === 'panelTodo.signOut'
        );
        const handler = signOutCall?.[1] as () => void;
        handler();

        expect(mockProvider.signOut).toHaveBeenCalled();
      });
    });

    describe('panelTodo.upgrade', () => {
      it('should call openUpgrade on provider', () => {
        const upgradeCall = vi.mocked(commands.registerCommand).mock.calls.find(
          (call) => call[0] === 'panelTodo.upgrade'
        );
        const handler = upgradeCall?.[1] as () => void;
        handler();

        expect(mockProvider.openUpgrade).toHaveBeenCalled();
      });
    });
  });

  describe('URI handler', () => {
    beforeEach(() => {
      activate(context as any);
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle /signin URI path', async () => {
      const uriHandlerCall = vi.mocked(window.registerUriHandler).mock.calls[0];
      const uriHandler = uriHandlerCall[0];

      // Mock executeCommand to resolve immediately
      vi.mocked(commands.executeCommand).mockResolvedValue(undefined);

      // Trigger URI handler
      uriHandler.handleUri(Uri.parse('vscode://paneltodo/signin'));

      // Wait for focus command
      await vi.runAllTimersAsync();

      expect(commands.executeCommand).toHaveBeenCalledWith('todoView.focus');
    });

    it('should handle /signin/ URI path with trailing slash', async () => {
      const uriHandlerCall = vi.mocked(window.registerUriHandler).mock.calls[0];
      const uriHandler = uriHandlerCall[0];

      vi.mocked(commands.executeCommand).mockResolvedValue(undefined);

      uriHandler.handleUri(Uri.parse('vscode://paneltodo/signin/'));

      await vi.runAllTimersAsync();

      expect(commands.executeCommand).toHaveBeenCalledWith('todoView.focus');
    });

    it('should not handle other URI paths', async () => {
      const uriHandlerCall = vi.mocked(window.registerUriHandler).mock.calls[0];
      const uriHandler = uriHandlerCall[0];

      uriHandler.handleUri(Uri.parse('vscode://paneltodo/other'));

      await vi.runAllTimersAsync();

      expect(commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should call signIn after focus command completes', async () => {
      const uriHandlerCall = vi.mocked(window.registerUriHandler).mock.calls[0];
      const uriHandler = uriHandlerCall[0];

      vi.mocked(commands.executeCommand).mockResolvedValue(undefined);

      uriHandler.handleUri(Uri.parse('vscode://paneltodo/signin'));

      // Advance past the focus and the 500ms delay
      await vi.advanceTimersByTimeAsync(600);

      expect(mockProvider.signIn).toHaveBeenCalled();
    });
  });
});
