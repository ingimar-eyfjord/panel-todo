/**
 * Unit tests for utils.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getNonce, delay, formatTodosAsPrompt, requestJson, getApiUrl, getApiHeaders } from '../src/utils';
import { CONFIG, STORAGE_KEYS } from '../src/types';
import { workspace, createMockExtensionContext, MockExtensionContext } from './__mocks__/vscode';

describe('utils', () => {
  describe('getNonce', () => {
    it('should generate a 32-character string', () => {
      const nonce = getNonce();
      expect(nonce).toHaveLength(32);
    });

    it('should only contain alphanumeric characters', () => {
      const nonce = getNonce();
      expect(nonce).toMatch(/^[A-Za-z0-9]+$/);
    });

    it('should generate unique nonces', () => {
      const nonces = new Set<string>();
      for (let i = 0; i < 100; i++) {
        nonces.add(getNonce());
      }
      // All 100 nonces should be unique
      expect(nonces.size).toBe(100);
    });

    it('should generate cryptographically random-like distribution', () => {
      // Generate multiple nonces and check character distribution
      const charCounts = new Map<string, number>();
      for (let i = 0; i < 1000; i++) {
        const nonce = getNonce();
        for (const char of nonce) {
          charCounts.set(char, (charCounts.get(char) || 0) + 1);
        }
      }

      // With 62 possible characters (A-Z, a-z, 0-9) and 32000 chars total,
      // each char should appear roughly 32000/62 ≈ 516 times
      // We'll check that no character appears way too often or rarely
      for (const [char, count] of charCounts) {
        expect(count).toBeGreaterThan(100); // At least appear sometimes
        expect(count).toBeLessThan(2000); // Not dominate
      }
    });
  });

  describe('delay', () => {
    it('should delay for the specified time', async () => {
      const start = Date.now();
      await delay(50);
      const elapsed = Date.now() - start;

      // Should be at least 50ms, allow some margin
      expect(elapsed).toBeGreaterThanOrEqual(45);
      expect(elapsed).toBeLessThan(200); // Should not take too long
    });

    it('should resolve with undefined', async () => {
      const result = await delay(1);
      expect(result).toBeUndefined();
    });

    it('should work with 0ms delay', async () => {
      const start = Date.now();
      await delay(0);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(50); // Should be nearly instant
    });
  });

  describe('formatTodosAsPrompt', () => {
    it('should format empty list', () => {
      const result = formatTodosAsPrompt([]);
      expect(result).toBe('## Current Tasks\n\n\n');
    });

    it('should format single todo', () => {
      const todos = [{ text: 'Buy milk' }];
      const result = formatTodosAsPrompt(todos);

      expect(result).toBe('## Current Tasks\n\n- [ ] Buy milk\n');
    });

    it('should format multiple todos', () => {
      const todos = [
        { text: 'Buy milk' },
        { text: 'Write tests' },
        { text: 'Deploy app' },
      ];
      const result = formatTodosAsPrompt(todos);

      expect(result).toBe(
        '## Current Tasks\n\n' +
        '- [ ] Buy milk\n' +
        '- [ ] Write tests\n' +
        '- [ ] Deploy app\n'
      );
    });

    it('should handle todos with special characters', () => {
      const todos = [
        { text: 'Fix bug #123' },
        { text: 'Update `README.md`' },
        { text: 'Add feature: user auth' },
      ];
      const result = formatTodosAsPrompt(todos);

      expect(result).toContain('- [ ] Fix bug #123');
      expect(result).toContain('- [ ] Update `README.md`');
      expect(result).toContain('- [ ] Add feature: user auth');
    });

    it('should handle todos with markdown formatting', () => {
      const todos = [
        { text: '**Bold task**' },
        { text: '_Italic task_' },
        { text: '[Link](http://example.com)' },
      ];
      const result = formatTodosAsPrompt(todos);

      expect(result).toContain('- [ ] **Bold task**');
      expect(result).toContain('- [ ] _Italic task_');
      expect(result).toContain('- [ ] [Link](http://example.com)');
    });

    it('should handle todos with newlines in text (edge case)', () => {
      const todos = [{ text: 'Line 1\nLine 2' }];
      const result = formatTodosAsPrompt(todos);

      expect(result).toContain('- [ ] Line 1\nLine 2');
    });
  });

  describe('requestJson', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should make GET request with fetch', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{"message":"success"}'),
      };
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as unknown as Response);

      const result = await requestJson('https://api.example.com/data');

      expect(globalThis.fetch).toHaveBeenCalledWith('https://api.example.com/data', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        body: undefined,
      });

      expect(result).toEqual({
        ok: true,
        status: 200,
        data: { message: 'success' },
      });
    });

    it('should make POST request with body', async () => {
      const mockResponse = {
        ok: true,
        status: 201,
        text: vi.fn().mockResolvedValue('{"id":"123"}'),
      };
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as unknown as Response);

      const result = await requestJson('https://api.example.com/items', {
        method: 'POST',
        body: { name: 'Test Item' },
      });

      expect(globalThis.fetch).toHaveBeenCalledWith('https://api.example.com/items', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: '{"name":"Test Item"}',
      });

      expect(result).toEqual({
        ok: true,
        status: 201,
        data: { id: '123' },
      });
    });

    it('should handle error responses', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue('{"error":"Not found"}'),
      };
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as unknown as Response);

      const result = await requestJson('https://api.example.com/missing');

      expect(result).toEqual({
        ok: false,
        status: 404,
        data: { error: 'Not found' },
      });
    });

    it('should handle empty response', async () => {
      const mockResponse = {
        ok: true,
        status: 204,
        text: vi.fn().mockResolvedValue(''),
      };
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as unknown as Response);

      const result = await requestJson('https://api.example.com/delete');

      expect(result).toEqual({
        ok: true,
        status: 204,
        data: undefined,
      });
    });

    it('should handle non-JSON response', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('Plain text response'),
      };
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as unknown as Response);

      const result = await requestJson('https://api.example.com/text');

      expect(result).toEqual({
        ok: true,
        status: 200,
        data: 'Plain text response',
      });
    });

    it('should include custom headers', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{}'),
      };
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as unknown as Response);

      await requestJson('https://api.example.com/auth', {
        headers: {
          Authorization: 'Bearer token123',
          'X-Custom-Header': 'custom-value',
        },
      });

      expect(globalThis.fetch).toHaveBeenCalledWith('https://api.example.com/auth', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer token123',
          'X-Custom-Header': 'custom-value',
        },
        body: undefined,
      });
    });

    it('should handle PATCH and DELETE methods', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{}'),
      };
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as unknown as Response);

      await requestJson('https://api.example.com/item/1', { method: 'PATCH', body: { name: 'Updated' } });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.example.com/item/1',
        expect.objectContaining({ method: 'PATCH' })
      );

      await requestJson('https://api.example.com/item/1', { method: 'DELETE' });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.example.com/item/1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('getApiUrl', () => {
    let originalDevMode: boolean;

    beforeEach(() => {
      originalDevMode = CONFIG.DEV_MODE;
      workspace.getConfiguration = vi.fn().mockReturnValue({
        get: vi.fn().mockImplementation((key: string, defaultValue?: unknown) => {
          if (key === 'apiBaseUrl') {
            return 'https://api.panel-todo.com';
          }
          return defaultValue;
        }),
      });
    });

    afterEach(() => {
      (CONFIG as any).DEV_MODE = originalDevMode;
    });

    it('should return production URL by default', () => {
      (CONFIG as any).DEV_MODE = false;

      const url = getApiUrl();
      expect(url).toBe('https://api.panel-todo.com');
    });

    it('should return dev URL when DEV_MODE is true', () => {
      (CONFIG as any).DEV_MODE = true;

      const url = getApiUrl();
      expect(url).toBe(CONFIG.DEV_API_URL);
    });

    it('should strip trailing slashes from URL', () => {
      (CONFIG as any).DEV_MODE = false;
      workspace.getConfiguration = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue('https://api.example.com///'),
      });

      const url = getApiUrl();
      expect(url).toBe('https://api.example.com');
    });

    it('should use custom URL from configuration', () => {
      (CONFIG as any).DEV_MODE = false;
      workspace.getConfiguration = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue('https://custom-api.example.com'),
      });

      const url = getApiUrl();
      expect(url).toBe('https://custom-api.example.com');
    });
  });

  describe('getApiHeaders', () => {
    let context: MockExtensionContext;
    let originalDevMode: boolean;

    beforeEach(() => {
      context = createMockExtensionContext();
      originalDevMode = CONFIG.DEV_MODE;
    });

    afterEach(() => {
      (CONFIG as any).DEV_MODE = originalDevMode;
    });

    it('should include Content-Type header by default', async () => {
      (CONFIG as any).DEV_MODE = false;

      const headers = await getApiHeaders(context as any);
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should not include Content-Type when includeContentType is false', async () => {
      (CONFIG as any).DEV_MODE = false;

      const headers = await getApiHeaders(context as any, { includeContentType: false });
      expect(headers['Content-Type']).toBeUndefined();
    });

    it('should include X-Dev-User header in dev mode', async () => {
      (CONFIG as any).DEV_MODE = true;

      const headers = await getApiHeaders(context as any);
      expect(headers['X-Dev-User']).toBe(CONFIG.DEV_FAKE_USER_ID);
      expect(headers['Authorization']).toBeUndefined();
    });

    it('should include Authorization header when token exists', async () => {
      (CONFIG as any).DEV_MODE = false;
      await context.secrets.store(STORAGE_KEYS.ACCESS_TOKEN, 'test-token-123');

      const headers = await getApiHeaders(context as any);
      expect(headers['Authorization']).toBe('Bearer test-token-123');
    });

    it('should not include Authorization header when no token', async () => {
      (CONFIG as any).DEV_MODE = false;

      const headers = await getApiHeaders(context as any);
      expect(headers['Authorization']).toBeUndefined();
    });
  });
});
