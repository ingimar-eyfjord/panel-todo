import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  Todo,
  TodoConflict,
  ConflictResolution,
  Issue,
  Sprint,
  Tag,
  Project,
  Comment,
  User,
  WebSocketEvent,
  CONFIG,
  STORAGE_KEYS,
  IssueStatus,
  IssuePriority,
  UserTier,
  CreateIssueInput,
  UpdateIssueInput,
  CreateSprintInput,
  CreateTagInput,
  UpdateTagInput,
  CreateProjectInput,
  IssuesResponse,
  SprintsResponse,
  TagsResponse,
  ProjectsResponse,
  CommentsResponse,
} from './types';
import { StorageService } from './services/StorageService';
import { ApiService } from './services/ApiService';
import { AuthService } from './services/AuthService';
import { WebSocketService } from './services/WebSocketService';
import { getHtml } from './webview/getHtml';
import { requestJson, formatTodosAsPrompt } from './utils';

interface WebviewMessage {
  type: string;
  text?: string;
  id?: string;
  issueId?: string;
  sprintId?: string;
  tagId?: string;
  tokenId?: string;
  projectId?: string;
  updates?: Record<string, unknown>;
  title?: string;
  name?: string;
  key?: string;
  priority?: IssuePriority;
  status?: IssueStatus;
  color?: string;
  content?: string;
  tier?: UserTier | 'out';
  moveToBacklog?: boolean;
  moveIncomplete?: boolean;
  resolution?: ConflictResolution;
}

/**
 * TodoViewProvider - Main webview provider for Panel Todo
 * Handles the webview panel in VS Code's bottom panel area
 */
export class TodoViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'todoView';

  private _view: vscode.WebviewView | null = null;
  private _lastDeleted: Todo | null = null;
  private _tags: Tag[] = [];
  private _conflicts: TodoConflict[] = [];
  private _fileWatcher: vscode.FileSystemWatcher | null = null;
  private _syncDebounceTimer: NodeJS.Timeout | null = null;
  private _disposed = false;
  private _pendingAuthStateUpdate = false;

  // Services
  private storage: StorageService;
  private api: ApiService;
  private auth: AuthService;
  private ws: WebSocketService;

  constructor(private readonly _context: vscode.ExtensionContext) {
    this.storage = new StorageService(_context);
    this.api = new ApiService(_context);
    this.auth = new AuthService(_context);
    this.ws = new WebSocketService(_context);

    // Wire up services for MCP config setup
    this.auth.setApiService(this.api);
    this.auth.setStorageService(this.storage);

    // Set up file watcher for MCP sync
    this._setupFileWatcher();

    // Set up WebSocket event handler
    this.ws.onEvent((event) => this._handleWsEvent(event));

    // Listen for auth state changes to update webview
    this.auth.onAuthStateChanged(async () => {
      await this._postAuthState();
      // Sync Pro data if now authenticated with Pro
      if (this.isPro()) {
        await this._syncFromCloud();
        await this._postProjects();
        await this._postIssues();
        await this._postSprints();
        await this._postTags();
        // Set up MCP config for seamless MCP integration
        await this.auth.setupMcpConfig();
      }
    });

    // Listen for connection state changes to update offline indicator
    this.ws.onConnectionStateChanged((connected) => {
      this._postConnectionState(connected);
    });
  }

  // ============================================
  // Public API (called from extension.ts)
  // ============================================

  async addTodoExternal(text: string): Promise<void> {
    await this._addTodo(text);
  }

  getAllTodos(): Todo[] {
    // Return only active (non-completed) todos for external callers
    return this._getTodos().filter((t) => !t.completed);
  }

  focusInput(): void {
    if (this._view) {
      this._view.show(true);
      this._view.webview.postMessage({ type: 'focusInput' });
    }
  }

  async undoDelete(): Promise<void> {
    if (!this._lastDeleted) {
      vscode.window.showInformationMessage('Nothing to undo');
      return;
    }

    const todos = this._getTodos();
    // Check if this was a completed todo (undo completion)
    const existingIndex = todos.findIndex((t) => t.id === this._lastDeleted!.id);
    if (existingIndex !== -1) {
      // Todo still exists (was completed, not removed) - mark as not completed
      todos[existingIndex].completed = false;
      todos[existingIndex].updatedAt = Date.now();
    } else {
      // Todo was actually removed - restore it
      const restored = { ...this._lastDeleted, completed: false };
      todos.push(restored);
    }
    await this._setTodos(todos);
    this._lastDeleted = null;
    vscode.window.showInformationMessage('Todo restored');
  }

  canUndo(): boolean {
    return this._lastDeleted !== null;
  }

  async signIn(): Promise<void> {
    await this.auth.signIn();
    await this._postAuthState();
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
    this._postAuthState();
    vscode.window.showInformationMessage('Signed out of Panel Todo');
  }

  isPro(): boolean {
    return this.auth.isPro();
  }

  /**
   * Add a todo from selected text in the editor
   */
  async addTodoFromSelection(text: string): Promise<void> {
    await this._addTodo(text);
  }

  /**
   * Export all todos as a markdown prompt and copy to clipboard
   */
  async exportTodosAsPrompt(): Promise<void> {
    // Only export active (non-completed) todos
    const todos = this._getTodos().filter((t) => !t.completed);
    if (todos.length === 0) {
      vscode.window.showInformationMessage('No todos to export');
      return;
    }
    const prompt = formatTodosAsPrompt(todos);
    await vscode.env.clipboard.writeText(prompt);
    vscode.window.showInformationMessage(`Copied ${todos.length} todos to clipboard`);
  }

  /**
   * Open the upgrade payment link
   */
  openUpgrade(): void {
    vscode.env.openExternal(vscode.Uri.parse(CONFIG.STRIPE_PRO_PAYMENT_LINK));
  }

  /**
   * Handle magic link authentication (called from URI handler)
   */
  async handleMagicLink(token: string): Promise<void> {
    await this.auth.handleMagicLink(token);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this._disposed = true;
    this.ws.disconnect();
    this.ws.clearHandlers();
    if (this._fileWatcher) {
      this._fileWatcher.dispose();
      this._fileWatcher = null;
    }
    if (this._syncDebounceTimer) {
      clearTimeout(this._syncDebounceTimer);
      this._syncDebounceTimer = null;
    }
    this._view = null;
  }

  // ============================================
  // WebviewViewProvider Implementation
  // ============================================

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    // Process any pending auth state update
    if (this._pendingAuthStateUpdate) {
      this._postAuthState();
    }

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = getHtml(webviewView.webview);

    // Connect WebSocket for real-time sync (async, but fire-and-forget)
    this.ws.connect().catch((err) => {
      console.error('Failed to connect WebSocket:', err);
    });

    // Cleanup on dispose
    webviewView.onDidDispose(() => {
      this.ws.disconnect();
      this._view = null;
    });

    // Handle messages from webview with error boundary
    webviewView.webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        try {
          await this._handleMessage(message);
        } catch (error) {
          console.error('Error handling webview message:', error);
          this._view?.webview.postMessage({
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      },
      undefined,
      this._context.subscriptions
    );
  }

  // ============================================
  // Message Handling
  // ============================================

  private async _handleMessage(message: WebviewMessage): Promise<void> {
    if (!message || typeof message.type !== 'string') {
      return;
    }

    switch (message.type) {
      case 'ready':
        this._postTodos();
        await this._postAuthState();
        this._postConnectionState(this.ws.isConnected);
        this._postConflicts();
        if (this.isPro()) {
          await this._syncFromCloud();
          await this._postProjects();
          await this._postIssues();
          await this._postSprints();
          await this._postTags();
        }
        break;

      case 'add':
        if (message.text) {
          await this._addTodo(message.text);
        }
        break;

      case 'remove':
        if (message.id) {
          await this._removeTodo(message.id);
        }
        break;

      case 'toggle':
        if (message.id) {
          await this._toggleTodo(message.id);
        }
        break;

      case 'edit':
        if (message.id && message.text) {
          await this._editTodo(message.id, message.text);
        }
        break;

      case 'undo':
        await this.undoDelete();
        break;

      case 'signIn':
        await this.signIn();
        break;

      case 'signOut':
        await this.signOut();
        break;

      case 'authCopyCode':
        await this.auth.copyUserCode();
        break;

      case 'authOpenLink':
        this.auth.openVerificationUri();
        break;

      case 'resolveConflict':
        if (message.id && message.resolution) {
          await this._resolveConflict(
            message.id as string,
            message.resolution as ConflictResolution
          );
        }
        break;

      case 'resolveAllConflicts':
        if (message.resolution) {
          this._resolveAllConflicts(message.resolution as ConflictResolution);
        }
        break;

      case 'openUpgrade':
        vscode.env.openExternal(vscode.Uri.parse(CONFIG.STRIPE_PRO_PAYMENT_LINK));
        break;

      case 'openUpgradeYearly':
        vscode.env.openExternal(vscode.Uri.parse(CONFIG.STRIPE_PRO_YEARLY_PAYMENT_LINK));
        break;

      case 'openMcpInfo':
        vscode.env.openExternal(
          vscode.Uri.parse('https://github.com/ingimar-eyfjord/panel-todo#mcp-integration')
        );
        break;

      case 'devSetTier':
        if (CONFIG.DEV_MODE && message.tier) {
          this.auth.setDevFakeTier(message.tier);
          await this._postAuthState();
        }
        break;

      case 'fetchIssues':
        await this._postIssues();
        break;

      case 'createIssue':
        if (message.title) {
          const newIssue = await this._createIssue({
            title: message.title,
            priority: message.priority || 'medium',
            status: message.status || 'todo',
            sprintId: message.sprintId,
          });
          if (newIssue) {
            await this._postIssues();
          }
        }
        break;

      case 'updateIssue':
        if (message.id && message.updates) {
          const updated = await this._updateIssue(message.id, message.updates as UpdateIssueInput);
          if (updated) {
            await this._postIssues();
          }
        }
        break;

      case 'deleteIssue':
        if (message.id) {
          const deleted = await this._deleteIssue(message.id);
          if (deleted) {
            await this._postIssues();
          }
        }
        break;

      case 'fetchComments':
        if (message.issueId) {
          const comments = await this._fetchComments(message.issueId);
          this._view?.webview.postMessage({
            type: 'comments',
            issueId: message.issueId,
            comments,
          });
        }
        break;

      case 'addComment':
        if (message.issueId && message.content) {
          const comment = await this._addComment(message.issueId, message.content);
          if (comment) {
            const comments = await this._fetchComments(message.issueId);
            this._view?.webview.postMessage({
              type: 'comments',
              issueId: message.issueId,
              comments,
            });
          }
        }
        break;

      case 'fetchSprints':
        await this._postSprints();
        break;

      case 'createSprint':
        if (message.name) {
          const newSprint = await this._createSprint({ name: message.name });
          if (newSprint) {
            await this._postSprints();
          }
        }
        break;

      case 'fetchBacklogIssues':
        if (message.sprintId) {
          await this._postBacklogIssues(message.sprintId);
        }
        break;

      case 'updateSprint':
        if (message.sprintId && message.name) {
          const updated = await this._updateSprint(message.sprintId, { name: message.name });
          if (updated) {
            await this._postSprints();
          }
        }
        break;

      case 'deleteSprint':
        if (message.sprintId) {
          const deleted = await this._deleteSprint(message.sprintId, message.moveToBacklog);
          if (deleted) {
            await this._postSprints();
            await this._postIssues();
          }
        }
        break;

      case 'completeSprint':
        if (message.sprintId) {
          const completed = await this._completeSprint(message.sprintId, message.moveIncomplete);
          if (completed) {
            await this._postSprints();
            await this._postIssues();
          }
        }
        break;

      case 'reactivateSprint':
        if (message.sprintId) {
          const reactivated = await this._reactivateSprint(message.sprintId);
          if (reactivated) {
            await this._postSprints();
            await this._postIssues();
          }
        }
        break;

      case 'fetchProjects':
        await this._postProjects();
        break;

      case 'switchProject':
        if (message.projectId) {
          await this.storage.setProjectId(message.projectId);
          await this._postProjects();
          await this._postIssues();
          await this._postSprints();
          await this._postTags();
        }
        break;

      case 'createProject':
        if (message.name && message.key) {
          const newProject = await this._createProject({
            name: message.name,
            key: message.key,
          });
          if (newProject) {
            await this.storage.setProjectId(newProject.id);
            await this._postProjects();
            await this._postIssues();
            await this._postSprints();
            await this._postTags();
          }
        }
        break;

      case 'fetchTags':
        await this._postTags();
        break;

      case 'createTag':
        if (message.name && message.color) {
          const newTag = await this._createTag({ name: message.name, color: message.color });
          if (newTag) {
            await this._postTags();
          }
        }
        break;

      case 'updateTag':
        if (message.tagId && message.updates) {
          const updated = await this._updateTag(message.tagId, message.updates as UpdateTagInput);
          if (updated) {
            await this._postTags();
          }
        }
        break;

      case 'deleteTag':
        if (message.tagId) {
          const deleted = await this._deleteTag(message.tagId);
          if (deleted) {
            await this._postTags();
            await this._postIssues();
          }
        }
        break;

      case 'addTagToIssue':
        if (message.issueId && message.tagId) {
          const success = await this._addTagToIssue(message.issueId, message.tagId);
          if (success) {
            let fullTag = this._tags.find((t) => t.id === message.tagId);
            if (!fullTag) {
              await this._postTags();
              fullTag = this._tags.find((t) => t.id === message.tagId);
            }
            if (fullTag) {
              this._view?.webview.postMessage({
                type: 'tagAdded',
                issueId: message.issueId,
                tag: fullTag,
              });
            }
            await this._postIssues();
          }
        }
        break;

      case 'removeTagFromIssue':
        if (message.issueId && message.tagId) {
          const success = await this._removeTagFromIssue(message.issueId, message.tagId);
          if (success) {
            this._view?.webview.postMessage({
              type: 'tagRemoved',
              issueId: message.issueId,
              tagId: message.tagId,
            });
            await this._postIssues();
          }
        }
        break;

      case 'sendToTerminal':
        if (message.text) {
          this._sendToTerminal(message.text);
        }
        break;

      case 'migrateUnassignedTodos':
        await this._migrateUnassignedTodos();
        break;

      case 'exportData':
        await this._exportUserData();
        break;

      case 'deleteAccount':
        await this._deleteUserAccount();
        break;

      case 'openLink':
        if ((message as { url?: string }).url) {
          vscode.env.openExternal(vscode.Uri.parse((message as { url?: string }).url!));
        }
        break;

      // API Token Management (for MCP integration)
      case 'showTokenNameInput': {
        // Show VS Code's native input box (prompt() doesn't work in webviews)
        const name = await vscode.window.showInputBox({
          prompt: 'Enter a name for this API token',
          value: 'Panel Todo MCP',
          placeHolder: 'Token name',
        });
        if (name) {
          const newToken = await this.api.createApiToken(name);
          if (newToken) {
            this._view?.webview.postMessage({
              type: 'apiTokenCreated',
              token: newToken,
            });
            await this._postApiTokens();
          } else {
            this._view?.webview.postMessage({
              type: 'error',
              error: 'Failed to create API token',
            });
          }
        }
        break;
      }

      case 'listApiTokens':
        await this._postApiTokens();
        break;

      case 'createApiToken':
        if (message.name) {
          console.log('[Panel Todo] Creating API token:', message.name);
          const newToken = await this.api.createApiToken(message.name);
          console.log('[Panel Todo] API token result:', newToken ? 'success' : 'failed');
          if (newToken) {
            this._view?.webview.postMessage({
              type: 'apiTokenCreated',
              token: newToken, // Only shown once!
            });
            await this._postApiTokens();
          } else {
            console.log('[Panel Todo] Token creation failed, sending error to webview');
            this._view?.webview.postMessage({
              type: 'error',
              error: 'Failed to create API token. Please check you are signed in.',
            });
          }
        }
        break;

      case 'revokeApiToken':
        if (message.tokenId) {
          const revoked = await this.api.revokeApiToken(message.tokenId);
          if (revoked) {
            this._view?.webview.postMessage({
              type: 'apiTokenRevoked',
              tokenId: message.tokenId,
            });
            await this._postApiTokens();
          } else {
            this._view?.webview.postMessage({
              type: 'error',
              error: 'Failed to revoke API token',
            });
          }
        }
        break;

      default:
        break;
    }
  }

  // ============================================
  // Todo Operations
  // ============================================

  private _getTodos(): Todo[] {
    return this.storage.getTodos();
  }

  private async _setTodos(todos: Todo[], skipCloudSync = false): Promise<void> {
    await this.storage.setTodos(todos);
    this._postTodos();

    if (!skipCloudSync && this.isPro()) {
      this._debouncedCloudSync();
    }
  }

  private async _addTodo(text: string): Promise<void> {
    const todos = this._getTodos();
    const newTodo: Todo = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      text: text.trim(),
      createdAt: Date.now(),
    };
    todos.push(newTodo);
    await this._setTodos(todos);
  }

  private async _removeTodo(id: string): Promise<void> {
    const todos = this._getTodos();
    const index = todos.findIndex((t) => t.id === id);
    if (index !== -1) {
      this._lastDeleted = todos[index];
      todos.splice(index, 1);
      await this._setTodos(todos);
    }
  }

  private async _toggleTodo(id: string): Promise<void> {
    const todos = this._getTodos();
    const todo = todos.find((t) => t.id === id);
    if (todo) {
      // Store for undo (before marking complete)
      this._lastDeleted = { ...todo };
      // Mark as completed
      todo.completed = true;
      todo.updatedAt = Date.now();
      await this._setTodos(todos);
    }
  }

  private async _editTodo(id: string, text: string): Promise<void> {
    const todos = this._getTodos();
    const todo = todos.find((t) => t.id === id);
    if (todo) {
      todo.text = text.trim();
      await this._setTodos(todos);
    }
  }

  private _postTodos(): void {
    if (this._view) {
      // Filter out completed todos - they stay in storage for sync but don't show in UI
      const activeTodos = this._getTodos().filter((t) => !t.completed);
      this._view.webview.postMessage({
        type: 'todos',
        todos: activeTodos,
      });
    }
  }

  // ============================================
  // Cloud Sync
  // ============================================

  private _debouncedCloudSync(): void {
    if (this._syncDebounceTimer) {
      clearTimeout(this._syncDebounceTimer);
    }
    this._syncDebounceTimer = setTimeout(() => {
      this._syncDebounceTimer = null;
      this._syncToCloud();
    }, 1000);
  }

  private async _syncToCloud(): Promise<void> {
    if (this._disposed || !this.isPro()) {
      return;
    }

    this._postSyncState(true);

    const todos = this._getTodos();
    const syncData = todos.map((todo) => ({
      id: todo.id,
      text: todo.text,
      completed: todo.completed || false,
      createdAt: todo.createdAt || Date.now(),
      updatedAt: todo.updatedAt || todo.createdAt || Date.now(),
      deletedAt: null,
    }));

    try {
      const response = await this.api.post('/sync', {
        workspaceId: this.storage.getWorkspaceId(),
        todos: syncData,
        lastSyncAt: this.storage.getLastSyncTime() || 0,
      });

      if (response.ok) {
        await this.storage.setLastSyncTime(Date.now());
      }
    } catch (err) {
      console.error('Error syncing to cloud:', err);
    } finally {
      this._postSyncState(false);
    }
  }

  private async _syncFromCloud(): Promise<void> {
    if (this._disposed || !this.isPro()) {
      return;
    }

    this._postSyncState(true);

    try {
      const workspaceId = this.storage.getWorkspaceId();
      const response = await this.api.get<{
        workspaceTodos: Todo[];
        unassignedTodos: Todo[];
      }>(`/sync?workspaceId=${encodeURIComponent(workspaceId)}`);

      if (response.ok && response.data) {
        const { workspaceTodos, unassignedTodos } = response.data;
        const localTodos = this.storage.getTodos();

        // First-time sync: cloud workspace is empty but we have local todos → migrate them
        if (workspaceTodos.length === 0 && localTodos.length > 0) {
          console.log('First sync: migrating', localTodos.length, 'local todos to cloud workspace');
          await this.api.post('/sync', {
            workspaceId,
            todos: localTodos,
          });
          // Keep local todos, they're now synced to cloud
        } else {
          // Normal sync: use workspace cloud data
          // Defensive filter: exclude any completed items from server response
          const activeTodos = workspaceTodos.filter((t: Todo) => !t.completed);
          await this._setTodos(activeTodos, true);
        }

        // Send unassigned todos to webview for legacy migration UI
        this._postUnassignedTodos(unassignedTodos);

        await this.storage.setLastSyncTime(Date.now());
      }
    } catch (err) {
      console.error('Error syncing from cloud:', err);
    } finally {
      this._postSyncState(false);
    }
  }

  /**
   * Post unassigned (legacy) todos to webview for migration UI
   */
  private _postUnassignedTodos(unassignedTodos: Todo[]): void {
    if (!this._view) {
      return;
    }
    this._view.webview.postMessage({
      type: 'unassignedTodos',
      todos: unassignedTodos,
    });
  }

  /**
   * Migrate unassigned (legacy) todos to current workspace
   */
  private async _migrateUnassignedTodos(): Promise<void> {
    if (!this.isPro()) {
      return;
    }

    try {
      const workspaceId = this.storage.getWorkspaceId();
      const response = await this.api.post('/sync/migrate', { workspaceId });

      if (response.ok) {
        // Re-sync to get updated todos
        await this._syncFromCloud();
        vscode.window.showInformationMessage('Todos migrated to this workspace');
      } else {
        vscode.window.showErrorMessage('Failed to migrate todos');
      }
    } catch (err) {
      console.error('Error migrating unassigned todos:', err);
      vscode.window.showErrorMessage('Error migrating todos');
    }
  }

  // ============================================
  // Conflict Resolution
  // ============================================

  private _postConflicts(): void {
    if (!this._view) {
      return;
    }
    this._view.webview.postMessage({
      type: 'conflicts',
      conflicts: this._conflicts,
    });
  }

  private async _resolveConflict(
    conflictId: string,
    resolution: ConflictResolution
  ): Promise<void> {
    const conflict = this._conflicts.find((c) => c.id === conflictId);
    if (!conflict) {
      return;
    }

    const todos = this._getTodos();

    switch (resolution) {
      case 'keep_local':
        // Keep local version - no changes needed, just remove conflict
        break;

      case 'keep_remote':
        // Replace local with remote
        const index = todos.findIndex((t) => t.id === conflict.localTodo.id);
        if (index !== -1) {
          todos[index] = conflict.remoteTodo;
          await this._setTodos(todos, false);
        }
        break;

      case 'keep_both':
        // Keep both - local stays, add remote as new todo
        const newTodo: Todo = {
          ...conflict.remoteTodo,
          id: `${conflict.remoteTodo.id}-remote-${Date.now()}`,
        };
        todos.push(newTodo);
        await this._setTodos(todos, false);
        break;
    }

    // Remove resolved conflict
    this._conflicts = this._conflicts.filter((c) => c.id !== conflictId);
    this._postConflicts();
    this._postTodos();
  }

  private _resolveAllConflicts(resolution: ConflictResolution): void {
    const conflictIds = this._conflicts.map((c) => c.id);
    for (const id of conflictIds) {
      this._resolveConflict(id, resolution);
    }
  }

  // ============================================
  // Auth State
  // ============================================

  private async _postAuthState(): Promise<void> {
    if (!this._view) {
      // Queue update for when view becomes available
      this._pendingAuthStateUpdate = true;
      return;
    }
    this._pendingAuthStateUpdate = false;

    const devFakeTier = this.auth.devFakeTier;

    if (devFakeTier !== null) {
      this._view.webview.postMessage({
        type: 'authState',
        signedIn: devFakeTier !== 'out',
        tier: devFakeTier === 'out' ? 'free' : devFakeTier,
        pending: null,
        devMode: CONFIG.DEV_MODE,
      });
      return;
    }

    let isAuthenticated = await this.auth.isAuthenticated();
    console.log('[Panel Todo] _postAuthState: isAuthenticated =', isAuthenticated, 'user =', this.auth.user);

    if (isAuthenticated && !this.auth.user) {
      console.log('[Panel Todo] Tokens exist but no user - fetching user info...');
      const user = await this.auth.fetchUserInfo();
      console.log('[Panel Todo] fetchUserInfo returned:', user);
      // Don't clear tokens on fetch failure - could be transient network error
      // Tokens are only cleared by AuthService when explicitly invalid (401/400)
      if (user) {
        console.log('[Panel Todo] Successfully loaded user info');
      }
      // Re-check auth state (tokens may still be valid even if fetch failed)
      isAuthenticated = await this.auth.isAuthenticated();
      console.log('[Panel Todo] After token check: isAuthenticated =', isAuthenticated);
    }

    this._view.webview.postMessage({
      type: 'authState',
      signedIn: isAuthenticated,
      tier: this.auth.getTier(),
      pending: this.auth.authPending,
    });

    // Also send user info for the account section
    if (isAuthenticated && this.auth.user) {
      this._view.webview.postMessage({
        type: 'userInfo',
        email: this.auth.user.email,
      });
    }
  }

  private _postConnectionState(connected: boolean): void {
    if (!this._view) {
      return;
    }
    this._view.webview.postMessage({
      type: 'connectionState',
      connected,
    });
  }

  private _postSyncState(syncing: boolean): void {
    if (!this._view) {
      return;
    }
    this._view.webview.postMessage({
      type: 'syncState',
      syncing,
    });
  }

  // ============================================
  // API Token Operations (for MCP integration)
  // ============================================

  private async _postApiTokens(): Promise<void> {
    if (!this._view || !this.isPro()) {
      return;
    }

    const tokens = await this.api.listApiTokens();
    this._view.webview.postMessage({
      type: 'apiTokens',
      tokens,
    });
  }

  // ============================================
  // Issue Operations
  // ============================================

  private async _fetchIssues(): Promise<Issue[]> {
    const projectId = await this._ensureProject();
    if (!projectId) {
      return [];
    }

    try {
      const response = await this.api.get<IssuesResponse>(`/v1/projects/${projectId}/issues`);
      if (response.ok && response.data?.issues) {
        return response.data.issues;
      }
      if (response.status === 404) {
        await this._handleProjectNotFound();
        return [];
      }
      return [];
    } catch (err) {
      console.error('Error fetching issues:', err);
      return [];
    }
  }

  private async _createIssue(input: CreateIssueInput): Promise<Issue | null> {
    const projectId = await this._ensureProject();
    if (!projectId) {
      return null;
    }

    try {
      const response = await this.api.post<Issue>(`/v1/projects/${projectId}/issues`, input);
      if (response.ok && response.data) {
        return response.data;
      }
      return null;
    } catch (err) {
      console.error('Error creating issue:', err);
      return null;
    }
  }

  private async _updateIssue(issueId: string, updates: UpdateIssueInput): Promise<Issue | null> {
    try {
      const response = await this.api.patch<Issue>(`/v1/issues/${issueId}`, updates);
      if (response.ok && response.data) {
        return response.data;
      }
      return null;
    } catch (err) {
      console.error('Error updating issue:', err);
      return null;
    }
  }

  private async _deleteIssue(issueId: string): Promise<boolean> {
    try {
      const response = await this.api.delete(`/v1/issues/${issueId}`);
      return response.ok;
    } catch (err) {
      console.error('Error deleting issue:', err);
      return false;
    }
  }

  private async _postIssues(): Promise<void> {
    if (!this._view) {
      return;
    }
    const issues = await this._fetchIssues();
    this._view.webview.postMessage({ type: 'issues', issues });
  }

  // ============================================
  // Comment Operations
  // ============================================

  private async _fetchComments(issueId: string): Promise<Comment[]> {
    try {
      const response = await this.api.get<CommentsResponse>(`/v1/issues/${issueId}/comments`);
      if (response.ok && response.data?.comments) {
        return response.data.comments;
      }
      return [];
    } catch (err) {
      console.error('Error fetching comments:', err);
      return [];
    }
  }

  private async _addComment(issueId: string, content: string): Promise<Comment | null> {
    try {
      const response = await this.api.post<Comment>(`/v1/issues/${issueId}/comments`, { content });
      return response.ok ? response.data ?? null : null;
    } catch (err) {
      console.error('Error adding comment:', err);
      return null;
    }
  }

  // ============================================
  // Sprint Operations
  // ============================================

  private async _fetchSprints(): Promise<Sprint[]> {
    const projectId = await this._ensureProject();
    if (!projectId) {
      return [];
    }

    try {
      const response = await this.api.get<SprintsResponse>(`/v1/projects/${projectId}/sprints`);
      if (response.ok && response.data?.sprints) {
        return response.data.sprints;
      }
      return [];
    } catch (err) {
      console.error('Error fetching sprints:', err);
      return [];
    }
  }

  private async _createSprint(input: CreateSprintInput): Promise<Sprint | null> {
    const projectId = await this._ensureProject();
    if (!projectId) {
      return null;
    }

    try {
      const response = await this.api.post<Sprint>(`/v1/projects/${projectId}/sprints`, input);
      if (response.ok && response.data) {
        return response.data;
      }
      return null;
    } catch (err) {
      console.error('Error creating sprint:', err);
      return null;
    }
  }

  private async _updateSprint(
    sprintId: string,
    updates: { name: string }
  ): Promise<Sprint | null> {
    try {
      const response = await this.api.patch<Sprint>(`/v1/sprints/${sprintId}`, updates);
      if (response.ok && response.data) {
        return response.data;
      }
      return null;
    } catch (err) {
      console.error('Error updating sprint:', err);
      return null;
    }
  }

  private async _deleteSprint(sprintId: string, moveToBacklog?: boolean): Promise<boolean> {
    try {
      const url = moveToBacklog
        ? `/v1/sprints/${sprintId}?moveToBacklog=true`
        : `/v1/sprints/${sprintId}`;
      const response = await this.api.delete(url);
      return response.ok;
    } catch (err) {
      console.error('Error deleting sprint:', err);
      return false;
    }
  }

  private async _completeSprint(sprintId: string, moveIncomplete?: boolean): Promise<boolean> {
    try {
      const response = await this.api.post(`/v1/sprints/${sprintId}/complete`, {
        moveIncomplete: moveIncomplete ?? true,
      });
      return response.ok;
    } catch (err) {
      console.error('Error completing sprint:', err);
      return false;
    }
  }

  private async _reactivateSprint(sprintId: string): Promise<boolean> {
    try {
      const response = await this.api.post(`/v1/sprints/${sprintId}/reactivate`, {});
      return response.ok;
    } catch (err) {
      console.error('Error reactivating sprint:', err);
      return false;
    }
  }

  private async _postSprints(): Promise<void> {
    if (!this._view) {
      return;
    }
    const sprints = await this._fetchSprints();
    this._view.webview.postMessage({ type: 'sprints', sprints });
  }

  private async _postBacklogIssues(sprintId: string): Promise<void> {
    if (!this._view) {
      return;
    }

    try {
      const response = await this.api.get<IssuesResponse>(`/v1/sprints/${sprintId}/backlog`);
      if (response.ok && response.data?.issues) {
        this._view.webview.postMessage({
          type: 'backlogIssues',
          sprintId,
          issues: response.data.issues,
        });
      }
    } catch (err) {
      console.error('Error fetching backlog issues:', err);
    }
  }

  // ============================================
  // Tag Operations
  // ============================================

  private async _fetchTags(): Promise<Tag[]> {
    const projectId = await this._ensureProject();
    if (!projectId) {
      return [];
    }

    try {
      const response = await this.api.get<TagsResponse>(`/v1/projects/${projectId}/tags`);
      if (response.ok && response.data?.tags) {
        this._tags = response.data.tags;
        return response.data.tags;
      }
      return [];
    } catch (err) {
      console.error('Error fetching tags:', err);
      return [];
    }
  }

  private async _createTag(input: CreateTagInput): Promise<Tag | null> {
    const projectId = await this._ensureProject();
    if (!projectId) {
      return null;
    }

    try {
      const response = await this.api.post<Tag>(`/v1/projects/${projectId}/tags`, input);
      if (response.ok && response.data) {
        return response.data;
      }
      return null;
    } catch (err) {
      console.error('Error creating tag:', err);
      return null;
    }
  }

  private async _updateTag(tagId: string, updates: UpdateTagInput): Promise<Tag | null> {
    try {
      const response = await this.api.patch<Tag>(`/v1/tags/${tagId}`, updates);
      if (response.ok && response.data) {
        return response.data;
      }
      return null;
    } catch (err) {
      console.error('Error updating tag:', err);
      return null;
    }
  }

  private async _deleteTag(tagId: string): Promise<boolean> {
    try {
      const response = await this.api.delete(`/v1/tags/${tagId}`);
      return response.ok;
    } catch (err) {
      console.error('Error deleting tag:', err);
      return false;
    }
  }

  private async _addTagToIssue(issueId: string, tagId: string): Promise<boolean> {
    try {
      const response = await this.api.post(`/v1/issues/${issueId}/tags`, { tagId });
      return response.ok;
    } catch (err) {
      console.error('Error adding tag to issue:', err);
      return false;
    }
  }

  private async _removeTagFromIssue(issueId: string, tagId: string): Promise<boolean> {
    try {
      const response = await this.api.delete(`/v1/issues/${issueId}/tags/${tagId}`);
      return response.ok;
    } catch (err) {
      console.error('Error removing tag from issue:', err);
      return false;
    }
  }

  private async _postTags(): Promise<void> {
    if (!this._view) {
      return;
    }
    const tags = await this._fetchTags();
    this._view.webview.postMessage({ type: 'tags', tags });
  }

  // ============================================
  // Project Operations
  // ============================================

  private async _ensureProject(): Promise<string | null> {
    let projectId = this.storage.getProjectId();

    if (projectId) {
      return projectId;
    }

    // Try to fetch user's projects and auto-select one
    try {
      const response = await this.api.get<ProjectsResponse>('/v1/projects');
      if (response.ok && response.data?.projects && response.data.projects.length > 0) {
        projectId = response.data.projects[0].id;
        await this.storage.setProjectId(projectId);
        return projectId;
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }

    return null;
  }

  private async _handleProjectNotFound(): Promise<void> {
    await this.storage.setProjectId(null);
    vscode.window.showWarningMessage(
      'Your current project was not found. Please select another project.'
    );
    await this._postProjects();
  }

  private async _fetchProjects(): Promise<Project[]> {
    try {
      const response = await this.api.get<ProjectsResponse>('/v1/projects');
      if (response.ok && response.data?.projects) {
        return response.data.projects;
      }
      return [];
    } catch (err) {
      console.error('Error fetching projects:', err);
      return [];
    }
  }

  private async _createProject(input: CreateProjectInput): Promise<Project | null> {
    try {
      const response = await this.api.post<Project>('/v1/projects', input);
      if (response.ok && response.data) {
        return response.data;
      }
      return null;
    } catch (err) {
      console.error('Error creating project:', err);
      return null;
    }
  }

  private async _postProjects(): Promise<void> {
    if (!this._view) {
      return;
    }

    const projects = await this._fetchProjects();
    const currentProjectId = this.storage.getProjectId();
    const currentProject = projects.find((p) => p.id === currentProjectId) || null;

    this._view.webview.postMessage({
      type: 'projects',
      projects,
      currentProject,
      currentProjectId,
    });
  }

  // ============================================
  // WebSocket Events
  // ============================================

  private async _handleWsEvent(event: WebSocketEvent): Promise<void> {
    if (this._disposed) {
      return;
    }

    console.log('WebSocket event received:', event.type);

    switch (event.type) {
      case 'connected':
        break;

      case 'issue:created':
      case 'issue:updated':
      case 'issue:deleted':
        await this._postIssues();
        break;

      case 'sprint:created':
      case 'sprint:updated':
      case 'sprint:deleted':
      case 'sprint:completed':
        await this._postSprints();
        await this._postIssues();
        break;

      case 'project:created':
      case 'project:updated':
        await this._postProjects();
        break;

      case 'project:deleted':
        const deletedProjectId = event.data?.id as string | undefined;
        const currentProjectId = this.storage.getProjectId();
        if (deletedProjectId && deletedProjectId === currentProjectId) {
          await this.storage.setProjectId(null);
          vscode.window.showWarningMessage(
            'Your current project was deleted. Please select another project.'
          );
        }
        await this._postProjects();
        break;

      case 'tag:created':
      case 'tag:updated':
      case 'tag:deleted':
        await this._postTags();
        await this._postIssues();
        break;
    }
  }

  // ============================================
  // File Watcher (MCP Sync)
  // ============================================

  private _setupFileWatcher(): void {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    const pattern = new vscode.RelativePattern(
      workspaceFolders[0],
      `.vscode/${CONFIG.TODO_FILE_NAME}`
    );

    this._fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

    this._fileWatcher.onDidChange(() => {
      this._postTodos();
    });

    this._fileWatcher.onDidCreate(() => {
      this._postTodos();
    });

    // Note: Don't add to context.subscriptions - managed manually in dispose()
  }

  // ============================================
  // Terminal
  // ============================================

  private _sendToTerminal(text: string): void {
    let terminal = vscode.window.activeTerminal;

    if (!terminal) {
      const terminals = vscode.window.terminals;
      if (terminals.length > 0) {
        terminal = terminals[0];
      } else {
        terminal = vscode.window.createTerminal('Panel Todo');
      }
    }

    terminal.show(true);
    terminal.sendText(text, false);

    vscode.window.showInformationMessage(
      `Sent to terminal: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`
    );
  }

  // ============================================
  // GDPR Operations
  // ============================================

  /**
   * Export all user data (GDPR Article 20 - Right to Data Portability)
   */
  private async _exportUserData(): Promise<void> {
    if (!this.isPro()) {
      this._view?.webview.postMessage({
        type: 'dataExportError',
        error: 'Export requires Pro subscription',
      });
      return;
    }

    try {
      const response = await this.api.get<object>('/me/export');

      if (response.ok && response.data) {
        this._view?.webview.postMessage({
          type: 'dataExport',
          data: response.data,
        });
      } else {
        this._view?.webview.postMessage({
          type: 'dataExportError',
          error: response.error || 'Failed to export data',
        });
      }
    } catch (err) {
      console.error('Error exporting data:', err);
      this._view?.webview.postMessage({
        type: 'dataExportError',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  /**
   * Delete user account (GDPR Article 17 - Right to Erasure)
   */
  private async _deleteUserAccount(): Promise<void> {
    if (!this.isPro()) {
      this._view?.webview.postMessage({
        type: 'deleteAccountError',
        error: 'Account deletion requires Pro subscription',
      });
      return;
    }

    try {
      const response = await this.api.delete('/me');

      if (response.ok) {
        // Clear local tokens and sign out
        await this.auth.signOut();

        // Notify webview
        this._view?.webview.postMessage({
          type: 'deleteAccountSuccess',
        });

        // Update auth state to show signed out
        await this._postAuthState();

        vscode.window.showInformationMessage('Your Panel Todo account has been deleted.');
      } else {
        this._view?.webview.postMessage({
          type: 'deleteAccountError',
          error: response.error || 'Failed to delete account',
        });
      }
    } catch (err) {
      console.error('Error deleting account:', err);
      this._view?.webview.postMessage({
        type: 'deleteAccountError',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }
}
