import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Todo, STORAGE_KEYS, CONFIG } from '../types';

/**
 * StorageService handles all persistence operations for Panel Todo
 * - workspaceState for todos (per-workspace)
 * - globalState for auth tokens and settings
 * - File-based storage for MCP integration
 */
export class StorageService {
  constructor(private context: vscode.ExtensionContext) {}

  // ============================================
  // Todo Storage (workspaceState + file for MCP)
  // ============================================

  /**
   * Get all todos from storage
   * Prioritizes file-based storage if MCP has been used
   */
  getTodos(): Todo[] {
    // Check if we should use file-based storage (MCP integration)
    const mcpMigrated = this.context.workspaceState.get<boolean>(STORAGE_KEYS.MCP_MIGRATED);

    if (mcpMigrated) {
      const fileTodos = this.getTodosFromFile();
      if (fileTodos !== null) {
        return fileTodos;
      }
    }

    // Fallback to workspaceState
    return this.context.workspaceState.get<Todo[]>(STORAGE_KEYS.ITEMS) || [];
  }

  /**
   * Save todos to storage
   */
  async setTodos(todos: Todo[]): Promise<void> {
    // Always write to both storage locations for compatibility
    await this.context.workspaceState.update(STORAGE_KEYS.ITEMS, todos);

    // Also write to file for MCP integration
    this.writeTodosToFile(todos);
  }

  /**
   * Get todos from .vscode/panel-todo.json file
   */
  private getTodosFromFile(): Todo[] | null {
    const filePath = this.getTodoFilePath();
    if (!filePath) {
      return null;
    }

    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        return data.todos || [];
      }
    } catch (err) {
      console.error('Error reading todo file:', err);
    }

    return null;
  }

  /**
   * Write todos to .vscode/panel-todo.json file
   */
  private writeTodosToFile(todos: Todo[]): void {
    const filePath = this.getTodoFilePath();
    if (!filePath) {
      return;
    }

    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(
        filePath,
        JSON.stringify({ todos, updatedAt: new Date().toISOString() }, null, 2)
      );

      // Mark as migrated to file-based storage
      this.context.workspaceState.update(STORAGE_KEYS.MCP_MIGRATED, true);
    } catch (err) {
      console.error('Error writing todo file:', err);
    }
  }

  /**
   * Get the path to the todo file in .vscode/
   */
  private getTodoFilePath(): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return null;
    }

    return path.join(
      workspaceFolders[0].uri.fsPath,
      '.vscode',
      CONFIG.TODO_FILE_NAME
    );
  }

  // ============================================
  // Auth Token Storage (secrets API)
  // ============================================

  async getAccessToken(): Promise<string | undefined> {
    return this.context.secrets.get(STORAGE_KEYS.ACCESS_TOKEN);
  }

  async setAccessToken(token: string): Promise<void> {
    await this.context.secrets.store(STORAGE_KEYS.ACCESS_TOKEN, token);
  }

  async getRefreshToken(): Promise<string | undefined> {
    return this.context.secrets.get(STORAGE_KEYS.REFRESH_TOKEN);
  }

  async setRefreshToken(token: string): Promise<void> {
    await this.context.secrets.store(STORAGE_KEYS.REFRESH_TOKEN, token);
  }

  async clearAuthTokens(): Promise<void> {
    await this.context.secrets.delete(STORAGE_KEYS.ACCESS_TOKEN);
    await this.context.secrets.delete(STORAGE_KEYS.REFRESH_TOKEN);
  }

  // ============================================
  // Project Storage (globalState)
  // ============================================

  getProjectId(): string | undefined {
    return this.context.globalState.get<string>(STORAGE_KEYS.PROJECT_ID);
  }

  async setProjectId(projectId: string | null): Promise<void> {
    if (projectId) {
      await this.context.globalState.update(STORAGE_KEYS.PROJECT_ID, projectId);
    } else {
      await this.context.globalState.update(STORAGE_KEYS.PROJECT_ID, undefined);
    }
  }

  // ============================================
  // Sync Tracking (globalState)
  // ============================================

  getLastSyncTime(): number | undefined {
    return this.context.globalState.get<number>(STORAGE_KEYS.LAST_SYNC_TIME);
  }

  async setLastSyncTime(timestamp: number): Promise<void> {
    await this.context.globalState.update(STORAGE_KEYS.LAST_SYNC_TIME, timestamp);
  }

  getPendingSync(): string[] {
    return this.context.globalState.get<string[]>(STORAGE_KEYS.PENDING_SYNC) || [];
  }

  async setPendingSync(ids: string[]): Promise<void> {
    await this.context.globalState.update(STORAGE_KEYS.PENDING_SYNC, ids);
  }
}
