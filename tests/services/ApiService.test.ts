/**
 * Unit tests for ApiService
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiService } from '../../src/services/ApiService';
import { createMockExtensionContext, MockExtensionContext, workspace } from '../__mocks__/vscode';
import { CONFIG, STORAGE_KEYS } from '../../src/types';
import * as utils from '../../src/utils';

// Mock the utils module
vi.mock('../../src/utils', () => ({
  requestJson: vi.fn(),
  getApiUrl: vi.fn().mockReturnValue('https://api.panel-todo.com'),
  getApiHeaders: vi.fn().mockResolvedValue({ 'Content-Type': 'application/json' }),
}));

describe('ApiService', () => {
  let context: MockExtensionContext;
  let apiService: ApiService;
  let originalDevMode: boolean;

  beforeEach(() => {
    context = createMockExtensionContext();
    apiService = new ApiService(context as any);

    // Store original DEV_MODE
    originalDevMode = CONFIG.DEV_MODE;

    // Reset mocks
    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(utils.getApiUrl).mockReturnValue('https://api.panel-todo.com');
    vi.mocked(utils.getApiHeaders).mockResolvedValue({ 'Content-Type': 'application/json' });
  });

  afterEach(() => {
    // Restore DEV_MODE
    (CONFIG as any).DEV_MODE = originalDevMode;
  });

  describe('request', () => {
    beforeEach(() => {
      (CONFIG as any).DEV_MODE = false;
    });

    it('should make request with full URL', async () => {
      vi.mocked(utils.requestJson).mockResolvedValue({
        ok: true,
        status: 200,
        data: { result: 'success' },
      });

      await apiService.request('/test/endpoint');

      expect(utils.requestJson).toHaveBeenCalledWith(
        'https://api.panel-todo.com/test/endpoint',
        expect.any(Object)
      );
    });

    it('should merge headers with options', async () => {
      vi.mocked(utils.requestJson).mockResolvedValue({
        ok: true,
        status: 200,
        data: {},
      });

      await apiService.request('/test', {
        headers: { 'X-Custom': 'value' },
      });

      expect(utils.requestJson).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Custom': 'value',
          }),
        })
      );
    });

    it('should pass through request options', async () => {
      vi.mocked(utils.requestJson).mockResolvedValue({
        ok: true,
        status: 200,
        data: {},
      });

      await apiService.request('/test', {
        method: 'POST',
        body: { name: 'test' },
      });

      expect(utils.requestJson).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: { name: 'test' },
        })
      );
    });

    it('should return API response', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        data: { items: [1, 2, 3] },
      };
      vi.mocked(utils.requestJson).mockResolvedValue(mockResponse);

      const result = await apiService.request<{ items: number[] }>('/items');

      expect(result).toEqual(mockResponse);
    });
  });

  describe('get', () => {
    it('should make GET request', async () => {
      vi.mocked(utils.requestJson).mockResolvedValue({
        ok: true,
        status: 200,
        data: { id: '123' },
      });

      await apiService.get('/items/123');

      expect(utils.requestJson).toHaveBeenCalledWith(
        expect.stringContaining('/items/123'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should return typed response', async () => {
      interface Item {
        id: string;
        name: string;
      }

      vi.mocked(utils.requestJson).mockResolvedValue({
        ok: true,
        status: 200,
        data: { id: '123', name: 'Test Item' },
      });

      const result = await apiService.get<Item>('/items/123');

      expect(result.data?.id).toBe('123');
      expect(result.data?.name).toBe('Test Item');
    });
  });

  describe('post', () => {
    it('should make POST request with body', async () => {
      vi.mocked(utils.requestJson).mockResolvedValue({
        ok: true,
        status: 201,
        data: { id: 'new-id' },
      });

      await apiService.post('/items', { name: 'New Item' });

      expect(utils.requestJson).toHaveBeenCalledWith(
        expect.stringContaining('/items'),
        expect.objectContaining({
          method: 'POST',
          body: { name: 'New Item' },
        })
      );
    });

    it('should work without body', async () => {
      vi.mocked(utils.requestJson).mockResolvedValue({
        ok: true,
        status: 200,
        data: {},
      });

      await apiService.post('/action');

      expect(utils.requestJson).toHaveBeenCalledWith(
        expect.stringContaining('/action'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('patch', () => {
    it('should make PATCH request with body', async () => {
      vi.mocked(utils.requestJson).mockResolvedValue({
        ok: true,
        status: 200,
        data: { id: '123', name: 'Updated' },
      });

      await apiService.patch('/items/123', { name: 'Updated' });

      expect(utils.requestJson).toHaveBeenCalledWith(
        expect.stringContaining('/items/123'),
        expect.objectContaining({
          method: 'PATCH',
          body: { name: 'Updated' },
        })
      );
    });
  });

  describe('delete', () => {
    it('should make DELETE request', async () => {
      vi.mocked(utils.requestJson).mockResolvedValue({
        ok: true,
        status: 204,
        data: undefined,
      });

      await apiService.delete('/items/123');

      expect(utils.requestJson).toHaveBeenCalledWith(
        expect.stringContaining('/items/123'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('Error handling', () => {
    it('should handle network errors', async () => {
      vi.mocked(utils.requestJson).mockRejectedValue(new Error('Network error'));

      await expect(apiService.get('/items')).rejects.toThrow('Network error');
    });

    it('should return error responses correctly', async () => {
      vi.mocked(utils.requestJson).mockResolvedValue({
        ok: false,
        status: 404,
        data: { error: 'Not found' },
      });

      const result = await apiService.get('/missing');

      expect(result.ok).toBe(false);
      expect(result.status).toBe(404);
    });

    it('should handle 401 unauthorized', async () => {
      vi.mocked(utils.requestJson).mockResolvedValue({
        ok: false,
        status: 401,
        data: { error: 'Unauthorized' },
      });

      const result = await apiService.get('/protected');

      expect(result.ok).toBe(false);
      expect(result.status).toBe(401);
    });

    it('should handle 500 server errors', async () => {
      vi.mocked(utils.requestJson).mockResolvedValue({
        ok: false,
        status: 500,
        data: { error: 'Internal server error' },
      });

      const result = await apiService.get('/buggy');

      expect(result.ok).toBe(false);
      expect(result.status).toBe(500);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle full CRUD workflow', async () => {
      // Create
      vi.mocked(utils.requestJson).mockResolvedValueOnce({
        ok: true,
        status: 201,
        data: { id: 'new-1', name: 'Item' },
      });

      const createResult = await apiService.post('/items', { name: 'Item' });
      expect(createResult.data).toEqual({ id: 'new-1', name: 'Item' });

      // Read
      vi.mocked(utils.requestJson).mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: { id: 'new-1', name: 'Item' },
      });

      const getResult = await apiService.get('/items/new-1');
      expect(getResult.data).toEqual({ id: 'new-1', name: 'Item' });

      // Update
      vi.mocked(utils.requestJson).mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: { id: 'new-1', name: 'Updated Item' },
      });

      const updateResult = await apiService.patch('/items/new-1', { name: 'Updated Item' });
      expect(updateResult.data).toEqual({ id: 'new-1', name: 'Updated Item' });

      // Delete
      vi.mocked(utils.requestJson).mockResolvedValueOnce({
        ok: true,
        status: 204,
        data: undefined,
      });

      const deleteResult = await apiService.delete('/items/new-1');
      expect(deleteResult.ok).toBe(true);
    });
  });
});
