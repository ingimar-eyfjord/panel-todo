import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  Todo,
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
  private _fileWatcher: vscode.FileSystemWatcher | null = null;
  private _syncDebounceTimer: NodeJS.Timeout | null = null;
  private _disposed = false;

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

    // Set up file watcher for MCP sync
    this._setupFileWatcher();

    // Set up WebSocket event handler
    this.ws.onEvent((event) => this._handleWsEvent(event));
  }

  // ============================================
  // Public API (called from extension.ts)
  // ============================================

  async addTodoExternal(text: string): Promise<void> {
    await this._addTodo(text);
  }

  getAllTodos(): Todo[] {
    return this._getTodos();
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
    todos.push(this._lastDeleted);
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
    const todos = this._getTodos();
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
      this._view.webview.postMessage({
        type: 'todos',
        todos: this._getTodos(),
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

    const todos = this._getTodos();
    const syncData = todos.map((todo) => ({
      id: todo.id,
      text: todo.text,
      completed: false,
      createdAt: todo.createdAt || Date.now(),
      updatedAt: todo.createdAt || Date.now(),
      deletedAt: null,
    }));

    try {
      const response = await this.api.post('/sync', {
        todos: syncData,
        lastSyncAt: this.storage.getLastSyncTime() || 0,
      });

      if (response.ok) {
        await this.storage.setLastSyncTime(Date.now());
      }
    } catch (err) {
      console.error('Error syncing to cloud:', err);
    }
  }

  private async _syncFromCloud(): Promise<void> {
    if (this._disposed || !this.isPro()) {
      return;
    }

    try {
      const response = await this.api.get<{ todos: Todo[] }>('/sync');
      if (response.ok && response.data?.todos) {
        await this._setTodos(response.data.todos, true);
        await this.storage.setLastSyncTime(Date.now());
      }
    } catch (err) {
      console.error('Error syncing from cloud:', err);
    }
  }

  // ============================================
  // Auth State
  // ============================================

  private async _postAuthState(): Promise<void> {
    if (!this._view) {
      return;
    }

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

    const isAuthenticated = await this.auth.isAuthenticated();

    if (isAuthenticated && !this.auth.user) {
      await this.auth.fetchUserInfo();
    }

    this._view.webview.postMessage({
      type: 'authState',
      signedIn: isAuthenticated,
      tier: this.auth.getTier(),
      pending: this.auth.authPending,
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
      const response = await this.api.post(`/v1/issues/${issueId}/tags/${tagId}`, {});
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
}
