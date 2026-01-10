/**
 * Unit tests for StorageService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageService } from '../../src/services/StorageService';
import { createMockExtensionContext, MockExtensionContext, workspace, Uri } from '../__mocks__/vscode';
import { STORAGE_KEYS } from '../../src/types';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

describe('StorageService', () => {
  let context: MockExtensionContext;
  let storageService: StorageService;

  beforeEach(() => {
    context = createMockExtensionContext();
    storageService = new StorageService(context as any);

    // Reset mocks
    vi.clearAllMocks();

    // Setup default workspace
    workspace.setWorkspaceFolders([
      { uri: Uri.file('/test/workspace'), name: 'test-workspace' },
    ]);
  });

  describe('Todo Storage', () => {
    describe('getTodos', () => {
      it('should return empty array when no todos exist', () => {
        const todos = storageService.getTodos();
        expect(todos).toEqual([]);
      });

      it('should return todos from workspaceState when not MCP migrated', () => {
        const mockTodos = [
          { id: '1', text: 'Test todo 1', createdAt: 1000 },
          { id: '2', text: 'Test todo 2', createdAt: 2000 },
        ];
        context.workspaceState.setForTest(STORAGE_KEYS.ITEMS, mockTodos);

        const todos = storageService.getTodos();
        expect(todos).toEqual(mockTodos);
      });

      it('should return todos from file when MCP migrated and file exists', () => {
        context.workspaceState.setForTest(STORAGE_KEYS.MCP_MIGRATED, true);

        const mockTodos = [
          { id: '1', text: 'File todo 1', createdAt: 1000 },
        ];
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ todos: mockTodos }));

        const todos = storageService.getTodos();
        expect(todos).toEqual(mockTodos);
        expect(fs.existsSync).toHaveBeenCalled();
        expect(fs.readFileSync).toHaveBeenCalled();
      });

      it('should fall back to workspaceState when MCP migrated but file does not exist', () => {
        context.workspaceState.setForTest(STORAGE_KEYS.MCP_MIGRATED, true);
        const mockTodos = [{ id: '1', text: 'Workspace todo', createdAt: 1000 }];
        context.workspaceState.setForTest(STORAGE_KEYS.ITEMS, mockTodos);

        vi.mocked(fs.existsSync).mockReturnValue(false);

        const todos = storageService.getTodos();
        expect(todos).toEqual(mockTodos);
      });

      it('should fall back to workspaceState when file read fails', () => {
        context.workspaceState.setForTest(STORAGE_KEYS.MCP_MIGRATED, true);
        const mockTodos = [{ id: '1', text: 'Workspace todo', createdAt: 1000 }];
        context.workspaceState.setForTest(STORAGE_KEYS.ITEMS, mockTodos);

        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockImplementation(() => {
          throw new Error('File read error');
        });

        // Should not throw, should fall back
        const todos = storageService.getTodos();
        expect(todos).toEqual(mockTodos);
      });

      it('should return null from file when no workspace folders', () => {
        context.workspaceState.setForTest(STORAGE_KEYS.MCP_MIGRATED, true);
        workspace.setWorkspaceFolders([]);

        const todos = storageService.getTodos();
        expect(todos).toEqual([]); // Falls back to empty from workspaceState
      });
    });

    describe('setTodos', () => {
      it('should save todos to workspaceState', async () => {
        const todos = [
          { id: '1', text: 'New todo', createdAt: Date.now() },
        ];

        await storageService.setTodos(todos);

        expect(context.workspaceState.get(STORAGE_KEYS.ITEMS)).toEqual(todos);
      });

      it('should also write to file for MCP integration', async () => {
        const todos = [
          { id: '1', text: 'New todo', createdAt: Date.now() },
        ];

        vi.mocked(fs.existsSync).mockReturnValue(true);

        await storageService.setTodos(todos);

        expect(fs.writeFileSync).toHaveBeenCalled();
        const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
        expect(writeCall[0]).toContain('panel-todo.json');

        const writtenData = JSON.parse(writeCall[1] as string);
        expect(writtenData.todos).toEqual(todos);
        expect(writtenData.updatedAt).toBeDefined();
      });

      it('should create .vscode directory if it does not exist', async () => {
        const todos = [{ id: '1', text: 'Todo', createdAt: Date.now() }];

        vi.mocked(fs.existsSync).mockReturnValue(false);

        await storageService.setTodos(todos);

        expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('.vscode'), { recursive: true });
      });

      it('should mark as MCP migrated after file write', async () => {
        const todos = [{ id: '1', text: 'Todo', createdAt: Date.now() }];

        await storageService.setTodos(todos);

        expect(context.workspaceState.get(STORAGE_KEYS.MCP_MIGRATED)).toBe(true);
      });

      it('should handle file write errors gracefully', async () => {
        const todos = [{ id: '1', text: 'Todo', createdAt: Date.now() }];

        vi.mocked(fs.writeFileSync).mockImplementation(() => {
          throw new Error('Write error');
        });

        // Should not throw
        await expect(storageService.setTodos(todos)).resolves.not.toThrow();

        // Should still save to workspaceState
        expect(context.workspaceState.get(STORAGE_KEYS.ITEMS)).toEqual(todos);
      });

      it('should not write to file when no workspace folders', async () => {
        workspace.setWorkspaceFolders([]);

        const todos = [{ id: '1', text: 'Todo', createdAt: Date.now() }];
        await storageService.setTodos(todos);

        expect(fs.writeFileSync).not.toHaveBeenCalled();
        // But should still save to workspaceState
        expect(context.workspaceState.get(STORAGE_KEYS.ITEMS)).toEqual(todos);
      });
    });
  });

  describe('Auth Token Storage', () => {
    describe('getAccessToken', () => {
      it('should return undefined when no token stored', async () => {
        const token = await storageService.getAccessToken();
        expect(token).toBeUndefined();
      });

      it('should return stored token', async () => {
        await context.secrets.store(STORAGE_KEYS.ACCESS_TOKEN, 'test-access-token');

        const token = await storageService.getAccessToken();
        expect(token).toBe('test-access-token');
      });
    });

    describe('setAccessToken', () => {
      it('should store token in secrets', async () => {
        await storageService.setAccessToken('new-access-token');

        const stored = await context.secrets.get(STORAGE_KEYS.ACCESS_TOKEN);
        expect(stored).toBe('new-access-token');
      });
    });

    describe('getRefreshToken', () => {
      it('should return undefined when no token stored', async () => {
        const token = await storageService.getRefreshToken();
        expect(token).toBeUndefined();
      });

      it('should return stored refresh token', async () => {
        await context.secrets.store(STORAGE_KEYS.REFRESH_TOKEN, 'test-refresh-token');

        const token = await storageService.getRefreshToken();
        expect(token).toBe('test-refresh-token');
      });
    });

    describe('setRefreshToken', () => {
      it('should store refresh token in secrets', async () => {
        await storageService.setRefreshToken('new-refresh-token');

        const stored = await context.secrets.get(STORAGE_KEYS.REFRESH_TOKEN);
        expect(stored).toBe('new-refresh-token');
      });
    });

    describe('clearAuthTokens', () => {
      it('should remove both tokens', async () => {
        await context.secrets.store(STORAGE_KEYS.ACCESS_TOKEN, 'access');
        await context.secrets.store(STORAGE_KEYS.REFRESH_TOKEN, 'refresh');

        await storageService.clearAuthTokens();

        expect(await context.secrets.get(STORAGE_KEYS.ACCESS_TOKEN)).toBeUndefined();
        expect(await context.secrets.get(STORAGE_KEYS.REFRESH_TOKEN)).toBeUndefined();
      });

      it('should not throw when tokens do not exist', async () => {
        await expect(storageService.clearAuthTokens()).resolves.not.toThrow();
      });
    });
  });

  describe('Project Storage', () => {
    describe('getProjectId', () => {
      it('should return undefined when no project selected', () => {
        const projectId = storageService.getProjectId();
        expect(projectId).toBeUndefined();
      });

      it('should return stored project ID', () => {
        context.globalState.setForTest(STORAGE_KEYS.PROJECT_ID, 'project-123');

        const projectId = storageService.getProjectId();
        expect(projectId).toBe('project-123');
      });
    });

    describe('setProjectId', () => {
      it('should store project ID in globalState', async () => {
        await storageService.setProjectId('project-456');

        expect(context.globalState.get(STORAGE_KEYS.PROJECT_ID)).toBe('project-456');
      });

      it('should remove project ID when set to null', async () => {
        context.globalState.setForTest(STORAGE_KEYS.PROJECT_ID, 'project-123');

        await storageService.setProjectId(null);

        expect(context.globalState.get(STORAGE_KEYS.PROJECT_ID)).toBeUndefined();
      });
    });
  });

  describe('Sync Tracking', () => {
    describe('getLastSyncTime', () => {
      it('should return undefined when never synced', () => {
        const time = storageService.getLastSyncTime();
        expect(time).toBeUndefined();
      });

      it('should return stored sync time', () => {
        context.globalState.setForTest(STORAGE_KEYS.LAST_SYNC_TIME, 1700000000000);

        const time = storageService.getLastSyncTime();
        expect(time).toBe(1700000000000);
      });
    });

    describe('setLastSyncTime', () => {
      it('should store sync timestamp', async () => {
        await storageService.setLastSyncTime(1700000000000);

        expect(context.globalState.get(STORAGE_KEYS.LAST_SYNC_TIME)).toBe(1700000000000);
      });
    });

    describe('getPendingSync', () => {
      it('should return empty array when no pending syncs', () => {
        const pending = storageService.getPendingSync();
        expect(pending).toEqual([]);
      });

      it('should return pending sync IDs', () => {
        context.globalState.setForTest(STORAGE_KEYS.PENDING_SYNC, ['id1', 'id2', 'id3']);

        const pending = storageService.getPendingSync();
        expect(pending).toEqual(['id1', 'id2', 'id3']);
      });
    });

    describe('setPendingSync', () => {
      it('should store pending sync IDs', async () => {
        await storageService.setPendingSync(['id1', 'id2']);

        expect(context.globalState.get(STORAGE_KEYS.PENDING_SYNC)).toEqual(['id1', 'id2']);
      });

      it('should allow empty array', async () => {
        await storageService.setPendingSync([]);

        expect(context.globalState.get(STORAGE_KEYS.PENDING_SYNC)).toEqual([]);
      });
    });
  });
});
