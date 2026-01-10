import * as vscode from 'vscode';
import { TodoViewProvider } from './TodoViewProvider';

let provider: TodoViewProvider | undefined;

/**
 * Activates the Panel Todo extension
 */
export function activate(context: vscode.ExtensionContext): void {
  // Create the provider instance
  provider = new TodoViewProvider(context);

  // Register the webview view provider
  const viewRegistration = vscode.window.registerWebviewViewProvider(
    'todoView',
    provider,
    {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    }
  );
  context.subscriptions.push(viewRegistration);

  // Register URI handler for deep links (e.g., from success page after checkout)
  const uriHandler = vscode.window.registerUriHandler({
    handleUri(uri: vscode.Uri): void {
      console.log('Panel Todo URI handler:', uri.toString());

      if (uri.path === '/signin' || uri.path === '/signin/') {
        // Ensure the panel is visible
        vscode.commands.executeCommand('todoView.focus').then(() => {
          // Small delay to ensure view is ready
          setTimeout(() => {
            provider?.signIn();
          }, 500);
        });
      }
    }
  });
  context.subscriptions.push(uriHandler);

  // Register commands
  const commands: Array<{ command: string; handler: () => void }> = [
    {
      command: 'panelTodo.addFromSelection',
      handler: () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const selection = editor.document.getText(editor.selection);
          if (selection.trim()) {
            provider?.addTodoFromSelection(selection.trim());
          } else {
            vscode.window.showInformationMessage('No text selected');
          }
        }
      },
    },
    {
      command: 'panelTodo.exportAsPrompt',
      handler: () => {
        provider?.exportTodosAsPrompt();
      },
    },
    {
      command: 'panelTodo.focusInput',
      handler: () => {
        provider?.focusInput();
      },
    },
    {
      command: 'panelTodo.undoDelete',
      handler: () => {
        provider?.undoDelete();
      },
    },
    {
      command: 'panelTodo.signIn',
      handler: () => {
        provider?.signIn();
      },
    },
    {
      command: 'panelTodo.signOut',
      handler: () => {
        provider?.signOut();
      },
    },
    {
      command: 'panelTodo.upgrade',
      handler: () => {
        provider?.openUpgrade();
      },
    },
  ];

  // Register all commands
  for (const { command, handler } of commands) {
    const disposable = vscode.commands.registerCommand(command, handler);
    context.subscriptions.push(disposable);
  }

  console.log('Panel Todo extension activated');
}

/**
 * Deactivates the Panel Todo extension
 */
export function deactivate(): void {
  provider?.dispose();
  provider = undefined;
  console.log('Panel Todo extension deactivated');
}
